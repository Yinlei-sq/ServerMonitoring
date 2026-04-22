import assert from 'node:assert/strict';
import test from 'node:test';

import { parseMemoryInfo } from '../../../../src/collectors/remote/linux/parsers/parseMemory.ts';

test('parseMemoryInfo parses /proc/meminfo into a memory summary', () => {
  const summary = parseMemoryInfo(
    [
      'MemTotal:       16384256 kB',
      'MemAvailable:    8192128 kB',
      'MemFree:         4096000 kB'
    ].join('\n')
  );

  assert.deepEqual(summary, {
    totalBytes: 16777478144,
    freeBytes: 8388739072,
    usedBytes: 8388739072,
    usagePercent: 50
  });
});
