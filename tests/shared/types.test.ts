import assert from 'node:assert/strict';
import test from 'node:test';

import { emptySnapshot } from '../../src/shared/types.ts';

test('emptySnapshot creates a local snapshot with unsupported module states', () => {
  const snapshot = emptySnapshot('local');

  assert.equal(snapshot.target, 'local');
  assert.equal(snapshot.host.hostname, '');
  assert.equal(snapshot.host.platform, '');
  assert.equal(snapshot.host.arch, '');
  assert.equal(snapshot.host.uptimeSeconds, 0);
  assert.equal(snapshot.host.updatedAt, '1970-01-01T00:00:00.000Z');
  assert.equal(snapshot.capabilities.canKillProcess, false);
  assert.equal(snapshot.capabilities.canRunCustomCommand, false);
  assert.equal(snapshot.capabilities.canClearCache, false);
  assert.equal(snapshot.capabilities.canRefreshEnvironment, false);
  assert.equal(snapshot.cpu.status, 'unsupported');
  assert.equal(snapshot.memory.status, 'unsupported');
  assert.equal(snapshot.disks.status, 'unsupported');
  assert.equal(snapshot.network.status, 'unsupported');
  assert.equal(snapshot.gpus.status, 'unsupported');
  assert.equal(snapshot.processes.status, 'unsupported');
});
