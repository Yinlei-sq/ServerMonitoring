import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateCpuUsagePercent,
  parseCpuCoreCount,
  parseCpuStatSample,
  parseLoadAverage
} from '../../../../src/collectors/remote/linux/parsers/parseCpu.ts';

test('parseLoadAverage parses the three Linux load average values', () => {
  assert.deepEqual(parseLoadAverage('0.10 0.20 0.30 1/123 4567\n'), [0.1, 0.2, 0.3]);
});

test('parseCpuStatSample extracts total and idle cpu times', () => {
  assert.deepEqual(
    parseCpuStatSample('cpu  100 50 25 825 0 0 0 0 0 0\n'),
    {
      idle: 825,
      total: 1000
    }
  );
});

test('calculateCpuUsagePercent computes usage from two cpu samples', () => {
  const previous = parseCpuStatSample('cpu  100 0 100 800 0 0 0 0 0 0\n');
  const current = parseCpuStatSample('cpu  160 0 140 840 0 0 0 0 0 0\n');

  assert.equal(calculateCpuUsagePercent(previous, current), 71.4);
});

test('parseCpuCoreCount parses a single nproc line', () => {
  assert.equal(parseCpuCoreCount('8\n'), 8);
});
