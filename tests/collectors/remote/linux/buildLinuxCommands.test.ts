import assert from 'node:assert/strict';
import test from 'node:test';

import { buildLinuxOverviewCommands } from '../../../../src/collectors/remote/linux/commands/buildLinuxCommands.ts';

test('buildLinuxOverviewCommands includes the Linux overview command set', () => {
  const commands = buildLinuxOverviewCommands();

  assert.equal(commands.host.hostname.command, 'hostname');
  assert.equal(commands.cpu.stat.command, 'cat');
  assert.deepEqual(commands.cpu.stat.args, ['/proc/stat']);
  assert.equal(commands.memory.command, 'cat');
  assert.deepEqual(commands.memory.args, ['/proc/meminfo']);
  assert.equal(commands.disks.command, 'df');
  assert.deepEqual(commands.disks.args, ['-kP']);
  assert.equal(commands.gpus.command, 'nvidia-smi');
  assert.equal(commands.processes.command, 'ps');
});
