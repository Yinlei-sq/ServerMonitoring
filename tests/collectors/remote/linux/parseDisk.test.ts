import assert from 'node:assert/strict';
import test from 'node:test';

import { parseDfOutput } from '../../../../src/collectors/remote/linux/parsers/parseDisk.ts';

test('parseDfOutput parses df -kP rows', () => {
  const disks = parseDfOutput(
    [
      'Filesystem     1024-blocks      Used Available Capacity Mounted on',
      '/dev/sda1        100000000 25000000  75000000      25% /'
    ].join('\n')
  );

  assert.deepEqual(disks, [
    {
      mount: '/',
      totalBytes: 102400000000,
      usedBytes: 25600000000,
      usagePercent: 25
    }
  ]);
});
