import assert from 'node:assert/strict';
import test from 'node:test';

import { ActionService, buildKillProcessCommand } from '../../src/actions/actionService.ts';
import { validateCustomCommand } from '../../src/actions/actionValidators.ts';
import { getCustomCommands } from '../../src/config/settings.ts';

test('getCustomCommands returns configured custom commands', () => {
  const configuration = {
    get: (key: string, defaultValue: unknown) => {
      if (key === 'customCommands') {
        return [
          { id: 'open-terminal', label: 'Open Terminal', command: 'wt' },
          { id: 'restart-service', label: 'Restart Service', command: 'systemctl restart app' }
        ];
      }

      return defaultValue;
    }
  };

  const commands = getCustomCommands(configuration as Parameters<typeof getCustomCommands>[0]);

  assert.deepEqual(commands, [
    { id: 'open-terminal', label: 'Open Terminal', command: 'wt' },
    { id: 'restart-service', label: 'Restart Service', command: 'systemctl restart app' }
  ]);
});

test('getCustomCommands filters malformed custom command entries', () => {
  const configuration = {
    get: (key: string, defaultValue: unknown) => {
      if (key === 'customCommands') {
        return [
          { id: 'open-terminal', label: 'Open Terminal', command: 'wt' },
          { id: '', label: 'Missing Id', command: 'echo bad' },
          { id: 'missing-command', label: 'Missing Command' },
          null,
          'not-an-object'
        ];
      }

      return defaultValue;
    }
  };

  const commands = getCustomCommands(configuration as Parameters<typeof getCustomCommands>[0]);

  assert.deepEqual(commands, [{ id: 'open-terminal', label: 'Open Terminal', command: 'wt' }]);
});

test('getCustomCommands rejects duplicate custom command ids', () => {
  const configuration = {
    get: (key: string, defaultValue: unknown) => {
      if (key === 'customCommands') {
        return [
          { id: 'restart-service', label: 'Restart Service', command: 'systemctl restart app' },
          { id: 'restart-service', label: 'Restart Service Copy', command: 'echo duplicate' }
        ];
      }

      return defaultValue;
    }
  };

  assert.throws(
    () => getCustomCommands(configuration as Parameters<typeof getCustomCommands>[0]),
    /Duplicate custom command id: restart-service/
  );
});

test('validateCustomCommand resolves an existing custom command id', () => {
  const commands = [
    { id: 'open-terminal', label: 'Open Terminal', command: 'wt' },
    { id: 'restart-service', label: 'Restart Service', command: 'systemctl restart app' }
  ];

  const command = validateCustomCommand(commands, 'restart-service');

  assert.equal(command, 'systemctl restart app');
});

test('validateCustomCommand rejects an unknown custom command id', () => {
  const commands = [{ id: 'open-terminal', label: 'Open Terminal', command: 'wt' }];

  assert.throws(() => validateCustomCommand(commands, 'missing'), /Unknown custom command/);
});

test('ActionService.killProcess selects the platform-specific command', async () => {
  const executedCommands: string[] = [];
  const service = new ActionService({
    platform: 'win32',
    runCommand: async (command) => {
      executedCommands.push(command);
      return { stdout: '', stderr: '' };
    }
  });

  await service.killProcess(1234);

  assert.deepEqual(executedCommands, ['taskkill /PID 1234 /F']);
});

test('buildKillProcessCommand rejects invalid pid values', () => {
  assert.throws(() => buildKillProcessCommand(0), /Invalid pid/);
  assert.throws(() => buildKillProcessCommand(-1), /Invalid pid/);
  assert.throws(() => buildKillProcessCommand(1.5), /Invalid pid/);
  assert.throws(() => buildKillProcessCommand(Number.NaN), /Invalid pid/);
  assert.throws(() => buildKillProcessCommand(Number.POSITIVE_INFINITY), /Invalid pid/);
});

test('ActionService.runCustomCommand executes the validated configured command', async () => {
  const executedCommands: string[] = [];
  const service = new ActionService({
    getCustomCommands: () => [{ id: 'restart-service', label: 'Restart Service', command: 'echo restart' }],
    runCommand: async (command) => {
      executedCommands.push(command);
      return { stdout: '', stderr: '' };
    }
  });

  await service.runCustomCommand('restart-service');

  assert.deepEqual(executedCommands, ['echo restart']);
});
