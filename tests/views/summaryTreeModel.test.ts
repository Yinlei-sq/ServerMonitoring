import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSummaryRows } from '../../src/views/summaryTreeModel.ts';
import { emptySnapshot } from '../../src/shared/types.ts';

test('buildSummaryRows returns a placeholder row when no snapshot is available', () => {
  const rows = buildSummaryRows(undefined);

  assert.deepEqual(rows, [
    {
      id: 'empty',
      label: 'No data yet',
      description: 'Run refresh to load a monitor snapshot.'
    }
  ]);
});

test('buildSummaryRows formats the key overview rows from a snapshot', () => {
  const snapshot = emptySnapshot('remote');
  snapshot.host.hostname = 'ssh-box';
  snapshot.host.platform = 'Linux';
  snapshot.host.arch = 'x64';
  snapshot.host.updatedAt = '2026-04-18T06:00:00.000Z';
  snapshot.cpu = {
    status: 'ok',
    data: {
      usagePercent: 62.4,
      cores: 8,
      load: [0.6, 0.9, 1.1]
    }
  };
  snapshot.memory = {
    status: 'ok',
    data: {
      usedBytes: 6 * 1024 ** 3,
      freeBytes: 2 * 1024 ** 3,
      totalBytes: 8 * 1024 ** 3,
      usagePercent: 75
    }
  };
  snapshot.processes = {
    status: 'ok',
    data: [
      {
        pid: 4321,
        name: 'node',
        cpuPercent: 18.2,
        memoryPercent: 7.1
      }
    ]
  };
  snapshot.capabilities.canKillProcess = true;

  const rows = buildSummaryRows(snapshot);

  assert.equal(rows[0].label, 'Target');
  assert.equal(rows[0].description, 'Remote');
  assert.equal(rows[1].description, 'ssh-box');
  assert.match(rows[2].description ?? '', /62\.4%/);
  assert.match(rows[3].description ?? '', /6\.0 GB \/ 8\.0 GB/);
  assert.deepEqual(rows[4].action, { type: 'killProcess', pid: 4321 });
  assert.match(rows[5].description ?? '', /2026/);
});

