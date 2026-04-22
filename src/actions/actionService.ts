import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import { getCustomCommands } from '../config/settings.ts';
import { validateCustomCommand } from './actionValidators.ts';

const execAsync = promisify(exec);

export interface ActionServiceOptions {
  getCustomCommands?: typeof getCustomCommands;
  runCommand?: CommandRunner;
  platform?: NodeJS.Platform;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export type CommandRunner = (command: string) => Promise<CommandResult>;

export class ActionService {
  private readonly getCustomCommands: typeof getCustomCommands;
  private readonly runCommand: CommandRunner;
  private readonly platform: NodeJS.Platform;

  constructor(options: ActionServiceOptions = {}) {
    this.getCustomCommands = options.getCustomCommands ?? getCustomCommands;
    this.runCommand = options.runCommand ?? defaultRunCommand;
    this.platform = options.platform ?? process.platform;
  }

  async runCustomCommand(commandId: string): Promise<CommandResult> {
    const command = validateCustomCommand(this.getCustomCommands(), commandId);
    return this.runCommand(command);
  }

  async killProcess(pid: number): Promise<CommandResult> {
    return this.runCommand(buildKillProcessCommand(pid, this.platform));
  }
}

export function buildKillProcessCommand(pid: number, platform: NodeJS.Platform = process.platform): string {
  assertValidPid(pid);
  return platform === 'win32' ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`;
}

async function defaultRunCommand(command: string): Promise<CommandResult> {
  return execAsync(command);
}

function assertValidPid(pid: number): void {
  if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(pid)) {
    throw new Error(`Invalid pid: ${pid}`);
  }
}
