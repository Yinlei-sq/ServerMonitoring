import assert from 'node:assert/strict';
import test from 'node:test';

import { RefreshScheduler } from '../../src/core/refreshScheduler.ts';
import { MonitorController } from '../../src/core/monitorController.ts';
import { emptySnapshot } from '../../src/shared/types.ts';

test('RefreshScheduler stores the configured refresh intervals', () => {
  const scheduler = new RefreshScheduler({
    overviewMs: 2000,
    processMs: 5000,
    diskMs: 15000
  });

  const intervals = scheduler.getIntervals();

  assert.deepEqual(intervals, {
    overviewMs: 2000,
    processMs: 5000,
    diskMs: 15000
  });

  intervals.overviewMs = 3000;

  assert.deepEqual(scheduler.getIntervals(), {
    overviewMs: 2000,
    processMs: 5000,
    diskMs: 15000
  });
});

test('MonitorController uses the local collector for a local target', async () => {
  let localCalls = 0;
  let remoteCalls = 0;
  const snapshot = emptySnapshot('local');
  snapshot.host.hostname = 'local-host';

  const controller = new MonitorController({
    localCollector: {
      collect: async () => {
        localCalls += 1;
        return snapshot;
      }
    },
    remoteCollector: {
      collect: async () => {
        remoteCalls += 1;
        return emptySnapshot('remote');
      }
    },
    getTarget: () => 'local'
  });

  const result = await controller.refreshOverview();

  assert.equal(result, snapshot);
  assert.equal(controller.getLatestSnapshot(), snapshot);
  assert.equal(localCalls, 1);
  assert.equal(remoteCalls, 0);
});

test('MonitorController uses the remote collector for a remote target when available', async () => {
  let localCalls = 0;
  let remoteCalls = 0;
  const snapshot = emptySnapshot('remote');
  snapshot.host.hostname = 'remote-host';

  const controller = new MonitorController({
    localCollector: {
      collect: async () => {
        localCalls += 1;
        return emptySnapshot('local');
      }
    },
    remoteCollector: {
      collect: async () => {
        remoteCalls += 1;
        return snapshot;
      }
    },
    getTarget: () => 'remote'
  });

  const result = await controller.refreshOverview();

  assert.equal(result, snapshot);
  assert.equal(controller.getLatestSnapshot(), snapshot);
  assert.equal(localCalls, 0);
  assert.equal(remoteCalls, 1);
});

test('MonitorController throws when remote target has no remote collector', async () => {
  const controller = new MonitorController({
    localCollector: {
      collect: async () => emptySnapshot('local')
    },
    getTarget: () => 'remote'
  });

  await assert.rejects(
    () => controller.refreshOverview(),
    /remote collector is not available/i
  );
});

test('MonitorController caches the latest snapshot after refresh', async () => {
  const snapshot = emptySnapshot('local');
  snapshot.host.hostname = 'cached-host';

  const controller = new MonitorController({
    localCollector: {
      collect: async () => snapshot
    },
    getTarget: () => 'local'
  });

  assert.equal(controller.getLatestSnapshot(), undefined);

  const result = await controller.refreshOverview();

  assert.equal(result, snapshot);
  assert.equal(controller.getLatestSnapshot(), snapshot);
});
