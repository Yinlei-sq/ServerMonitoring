import type { CustomCommandSetting } from '../config/settings.ts';

export function validateCustomCommand(
  commands: readonly CustomCommandSetting[],
  commandId: string
): string {
  const matches = commands.filter((command) => command.id === commandId);

  if (matches.length > 1) {
    throw new Error(`Duplicate custom command id: ${commandId}`);
  }

  const match = matches[0];

  if (!match) {
    throw new Error('Unknown custom command');
  }

  return match.command;
}
