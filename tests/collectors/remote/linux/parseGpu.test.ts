import assert from 'node:assert/strict';
import test from 'node:test';

import { parseNvidiaSmiCsv } from '../../../../src/collectors/remote/linux/parsers/parseGpu.ts';

test('parseNvidiaSmiCsv parses nvidia-smi csv rows', () => {
  const gpus = parseNvidiaSmiCsv(
    [
      '0, NVIDIA A100-SXM4-40GB, 12, 1024, 40960',
      '1, NVIDIA A100-SXM4-40GB, 0, 0, 40960'
    ].join('\n')
  );

  assert.deepEqual(gpus, [
    {
      index: 0,
      name: 'NVIDIA A100-SXM4-40GB',
      usagePercent: 12,
      memoryUsedMb: 1024,
      memoryTotalMb: 40960
    },
    {
      index: 1,
      name: 'NVIDIA A100-SXM4-40GB',
      usagePercent: 0,
      memoryUsedMb: 0,
      memoryTotalMb: 40960
    }
  ]);
});

test('parseNvidiaSmiCsv throws when non-empty output has no valid gpu rows', () => {
  assert.throws(
    () => parseNvidiaSmiCsv('bad,row\n'),
    /failed to parse nvidia-smi csv output/i
  );
});
