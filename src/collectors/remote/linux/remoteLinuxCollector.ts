import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { emptySnapshot } from '../../../shared/types.ts';
import type { MonitorSnapshot, ModuleState } from '../../../shared/types.ts';
import { buildLinuxOverviewCommands } from './commands/buildLinuxCommands.ts';
import {
  calculateCpuUsagePercent,
  parseCpuCoreCount,
  parseCpuStatSample,
  parseLoadAverage
} from './parsers/parseCpu.ts';
import { parseDfOutput } from './parsers/parseDisk.ts';
import { parseNvidiaSmiCsv } from './parsers/parseGpu.ts';
import { parseMemoryInfo } from './parsers/parseMemory.ts';
import { parsePsOutput } from './parsers/parseProcesses.ts';

const execFileAsync = promisify(execFile);

export interface RemoteLinuxCollectorOptions {
  now?: () => Date;
  sampleDelayMs?: number;
  runCommand?: (command: string, args?: string[]) => Promise<string>;
}

export class RemoteLinuxCollector {
  private readonly now: () => Date;
  private readonly sampleDelayMs: number;
  private readonly runCommand: (command: string, args?: string[]) => Promise<string>;

  constructor(options: RemoteLinuxCollectorOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.sampleDelayMs = options.sampleDelayMs ?? 100;
    // This collector runs in the remote extension host, so execFile is the correct default runner.
    this.runCommand = options.runCommand ?? defaultRunCommand;
  }

  async collect(): Promise<MonitorSnapshot> {
    const commands = buildLinuxOverviewCommands();
    const snapshot = emptySnapshot('remote');

    snapshot.host = await this.collectHost(commands.host);
    snapshot.cpu = await this.collectCpu(commands.cpu);
    snapshot.memory = await this.collectMemory(commands.memory);
    snapshot.disks = await this.collectOptionalModule(() =>
      this.runCommand(commands.disks.command, commands.disks.args).then(parseDfOutput)
    );
    snapshot.gpus = await this.collectOptionalModule(() =>
      this.runCommand(commands.gpus.command, commands.gpus.args).then(parseNvidiaSmiCsv)
    );
    snapshot.processes = await this.collectOptionalModule(() =>
      this.runCommand(commands.processes.command, commands.processes.args).then(parsePsOutput)
    );

    return snapshot;
  }

  private async collectHost(commands: ReturnType<typeof buildLinuxOverviewCommands>['host']): Promise<MonitorSnapshot['host']> {
    const hostname = await this.readText(commands.hostname, '');
    const platform = await this.readText(commands.platform, 'Linux');
    const arch = await this.readText(commands.arch, '');
    const uptimeSeconds = await this.readUptime(commands.uptime);

    return {
      hostname,
      platform,
      arch,
      uptimeSeconds,
      updatedAt: this.now().toISOString()
    };
  }

  private async collectCpu(commands: ReturnType<typeof buildLinuxOverviewCommands>['cpu']): Promise<MonitorSnapshot['cpu']> {
    try {
      const firstSample = parseCpuStatSample(await this.runCommand(commands.stat.command, commands.stat.args));
      await this.delay(this.sampleDelayMs);
      const secondSample = parseCpuStatSample(await this.runCommand(commands.stat.command, commands.stat.args));
      const load = parseLoadAverage(await this.runCommand(commands.load.command, commands.load.args));
      const cores = parseCpuCoreCount(await this.runCommand(commands.cores.command, commands.cores.args));

      return {
        status: 'ok',
        data: {
          usagePercent: calculateCpuUsagePercent(firstSample, secondSample),
          cores,
          load
        }
      };
    } catch (error) {
      return this.classifyModuleError(error);
    }
  }

  private async collectMemory(commands: ReturnType<typeof buildLinuxOverviewCommands>['memory']): Promise<MonitorSnapshot['memory']> {
    try {
      return {
        status: 'ok',
        data: parseMemoryInfo(await this.runCommand(commands.command, commands.args))
      };
    } catch (error) {
      return this.classifyModuleError(error);
    }
  }

  private async collectOptionalModule<T>(loader: () => Promise<T>): Promise<ModuleState<T>> {
    try {
      return {
        status: 'ok',
        data: await loader()
      };
    } catch (error) {
      return this.classifyModuleError(error);
    }
  }

  private async readText(command: { command: string; args: string[] }, fallback: string): Promise<string> {
    try {
      const value = (await this.runCommand(command.command, command.args)).trim();
      return value.length > 0 ? value : fallback;
    } catch {
      return fallback;
    }
  }

  private async readUptime(command: { command: string; args: string[] }): Promise<number> {
    try {
      const output = await this.runCommand(command.command, command.args);
      const [secondsText] = output.trim().split(/\s+/);
      const seconds = Number(secondsText);
      if (!Number.isFinite(seconds) || seconds < 0) {
        return 0;
      }

      return seconds;
    } catch {
      return 0;
    }
  }

  private classifyModuleError<T>(error: unknown): ModuleState<T> {
    if (isMissingCommandError(error)) {
      return { status: 'unsupported' };
    }

    if (isPermissionDeniedError(error)) {
      return { status: 'permissionDenied' };
    }

    return { status: 'commandFailed' };
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function defaultRunCommand(command: string, args: string[] = []): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024
  });

  return stdout;
}

function isMissingCommandError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';

  return candidate.code === 'ENOENT' || message.includes('not found');
}

function isPermissionDeniedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as { code?: unknown; errno?: unknown; message?: unknown };
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';

  return (
    candidate.code === 'EACCES' ||
    candidate.code === 'EPERM' ||
    candidate.errno === -13 ||
    message.includes('permission denied')
  );
}
