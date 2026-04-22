import assert from 'node:assert/strict';
import test from 'node:test';

import { parsePsOutput } from '../../../../src/collectors/remote/linux/parsers/parseProcesses.ts';

test('parsePsOutput parses ps rows with pid user cpu memory and command', () => {
  const processes = parsePsOutput(
    [
      '1234 alice 3.2 1.1 node',
      '4321 root 0.5 0.2 systemd'
    ].join('\n')
  );

  assert.deepEqual(processes, [
    {
      pid: 1234,
      name: 'node',
      cpuPercent: 3.2,
      memoryPercent: 1.1,
      user: 'alice'
    },
    {
      pid: 4321,
      name: 'systemd',
      cpuPercent: 0.5,
      memoryPercent: 0.2,
      user: 'root'
    }
  ]);
});

test('parsePsOutput throws when non-empty output has no valid process rows', () => {
  assert.throws(() => parsePsOutput('bad row\n'), /failed to parse ps output/i);
});
