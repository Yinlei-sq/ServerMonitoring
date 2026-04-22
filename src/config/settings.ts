import type * as vscode from 'vscode';

export interface CustomCommandSetting {
  id: string;
  label: string;
  command: string;
}

export interface ConfigurationLike {
  get<T>(section: string, defaultValue: T): T;
}

export function getCustomCommands(
  configuration: ConfigurationLike = getServerMonitorConfiguration()
): CustomCommandSetting[] {
  const commands = configuration.get<unknown>('customCommands', []);
  return normalizeCustomCommands(Array.isArray(commands) ? commands : []);
}

function getServerMonitorConfiguration(): ConfigurationLike {
  const vscodeApi = require('vscode') as typeof vscode;
  return vscodeApi.workspace.getConfiguration('serverMonitor');
}

function normalizeCustomCommands(commands: unknown[]): CustomCommandSetting[] {
  const normalized: CustomCommandSetting[] = [];
  const seenIds = new Set<string>();

  for (const command of commands) {
    if (!isCustomCommandSetting(command)) {
      continue;
    }

    if (seenIds.has(command.id)) {
      throw new Error(`Duplicate custom command id: ${command.id}`);
    }

    seenIds.add(command.id);
    normalized.push(command);
  }

  return normalized;
}

function isCustomCommandSetting(command: unknown): command is CustomCommandSetting {
  if (typeof command !== 'object' || command === null) {
    return false;
  }

  const candidate = command as Partial<CustomCommandSetting>;

  return (
    typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    typeof candidate.label === 'string' &&
    candidate.label.trim().length > 0 &&
    typeof candidate.command === 'string' &&
    candidate.command.trim().length > 0
  );
}
