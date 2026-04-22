import { execFile } from 'node:child_process';
import os from 'node:os';
import { promisify } from 'node:util';

import { emptySnapshot } from '../../../shared/types.ts';
import type {
  DiskSummary,
  MonitorSnapshot,
  ModuleState
} from '../../../shared/types.ts';

const execFileAsync = promisify(execFile);
const cpuSampleDelayMs = 100;

export interface OverviewCollectorProbes {
  hostname?: () => string;
  platform?: () => string;
  arch?: () => string;
  uptimeSeconds?: () => number;
  now?: () => Date;
  cpuCount?: () => number;
  loadAverage?: () => [number, number, number];
  totalMemoryBytes?: () => number;
  freeMemoryBytes?: () => number;
  cpuUsagePercent?: () => number | Promise<number>;
}

export interface PlatformCollectorOptions {
  probes?: OverviewCollectorProbes;
}

interface OverviewCollectorOptions {
  probes?: OverviewCollectorProbes;
  readDisks?: () => Promise<DiskSummary[]>;
}

export interface SnapshotCollector {
  collect(): Promise<MonitorSnapshot>;
}

export function createOverviewCollector(options: OverviewCollectorOptions = {}): SnapshotCollector {
  return {
    collect: async () => {
      const probes = resolveProbes(options.probes);
      const snapshot = emptySnapshot('local');

      snapshot.host = {
        hostname: probes.hostname(),
        platform: probes.platform(),
        arch: probes.arch(),
        uptimeSeconds: probes.uptimeSeconds(),
        updatedAt: probes.now().toISOString()
      };

      snapshot.cpu = await collectCpuState(probes);
      snapshot.memory = await collectMemoryState(probes);
      snapshot.disks = await collectDiskState(options.readDisks);

      return snapshot;
    }
  };
}

function resolveProbes(probes?: OverviewCollectorProbes): Required<OverviewCollectorProbes> {
  return {
    hostname: probes?.hostname ?? os.hostname,
    platform: probes?.platform ?? os.platform,
    arch: probes?.arch ?? os.arch,
    uptimeSeconds: probes?.uptimeSeconds ?? os.uptime,
    now: probes?.now ?? (() => new Date()),
    cpuCount: probes?.cpuCount ?? (() => os.cpus().length),
    loadAverage:
      probes?.loadAverage ??
      (() => {
        const [one, five, fifteen] = os.loadavg();
        return [one, five, fifteen] as [number, number, number];
      }),
    totalMemoryBytes: probes?.totalMemoryBytes ?? os.totalmem,
    freeMemoryBytes: probes?.freeMemoryBytes ?? os.freemem,
    cpuUsagePercent: probes?.cpuUsagePercent ?? measureCpuUsagePercent
  };
}

async function measureCpuUsagePercent(): Promise<number> {
  const start = os.cpus();
  await new Promise((resolve) => setTimeout(resolve, cpuSampleDelayMs));
  const end = os.cpus();

  let totalDiff = 0;
  let idleDiff = 0;

  for (let index = 0; index < Math.min(start.length, end.length); index += 1) {
    const startCpu = start[index];
    const endCpu = end[index];
    const startTotal = cpuTimesTotal(startCpu.times);
    const endTotal = cpuTimesTotal(endCpu.times);
    totalDiff += Math.max(endTotal - startTotal, 0);
    idleDiff += Math.max(endCpu.times.idle - startCpu.times.idle, 0);
  }

  if (totalDiff <= 0) {
    return 0;
  }

  return Number((((totalDiff - idleDiff) / totalDiff) * 100).toFixed(1));
}

function cpuTimesTotal(times: { user: number; nice: number; sys: number; irq: number; idle: number }): number {
  return times.user + times.nice + times.sys + times.irq + times.idle;
}

async function collectCpuState(
  probes: Required<OverviewCollectorProbes>
): Promise<ModuleState<{ usagePercent: number; cores: number; load: [number, number, number] }>> {
  try {
    const usagePercent = await probes.cpuUsagePercent();
    return {
      status: 'ok',
      data: {
        usagePercent,
        cores: probes.cpuCount(),
        load: probes.loadAverage()
      }
    };
  } catch {
    return { status: 'commandFailed' };
  }
}

async function collectMemoryState(
  probes: Required<OverviewCollectorProbes>
): Promise<ModuleState<{ usedBytes: number; freeBytes: number; totalBytes: number; usagePercent: number }>> {
  try {
    const totalBytes = probes.totalMemoryBytes();
    const freeBytes = probes.freeMemoryBytes();
    const usedBytes = Math.max(totalBytes - freeBytes, 0);
    return {
      status: 'ok',
      data: {
        totalBytes,
        freeBytes,
        usedBytes,
        usagePercent: totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0
      }
    };
  } catch {
    return { status: 'commandFailed' };
  }
}

async function collectDiskState(
  readDisks?: () => Promise<DiskSummary[]>
): Promise<ModuleState<DiskSummary[]>> {
  if (!readDisks) {
    return { status: 'unsupported' };
  }

  try {
    const disks = await readDisks();
    return { status: 'ok', data: disks };
  } catch (error) {
    return { status: classifyDiskError(error) };
  }
}

function classifyDiskError(error: unknown): 'permissionDenied' | 'commandFailed' {
  if (isPermissionDeniedError(error)) {
    return 'permissionDenied';
  }

  return 'commandFailed';
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

export async function collectPosixDisks(): Promise<DiskSummary[]> {
  if (process.platform === 'win32') {
    throw new Error('unsupported platform');
  }

  const { stdout } = await execFileAsync('df', ['-kP']);
  return parseDfOutput(stdout);
}

function parseDfOutput(stdout: string): DiskSummary[] {
  const lines = stdout.trim().split(/\r?\n/);
  const rows = lines.slice(1);
  const disks: DiskSummary[] = [];

  for (const line of rows) {
    const match = line.match(/^(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)%\s+(.+)$/);
    if (!match) {
      continue;
    }

    const totalBlocks = Number(match[2]);
    const usedBlocks = Number(match[3]);
    const usagePercent = Number(match[5]);

    disks.push({
      mount: match[6],
      totalBytes: totalBlocks * 1024,
      usedBytes: usedBlocks * 1024,
      usagePercent
    });
  }

  if (disks.length === 0) {
    throw new Error('failed to parse df output');
  }

  return disks;
}
