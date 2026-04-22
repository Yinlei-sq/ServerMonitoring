import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveMonitorTarget } from '../../src/core/targetResolver.ts';

test('resolveMonitorTarget returns remote in a remote window when a remote collector is available', () => {
  const target = resolveMonitorTarget({
    isRemoteWindow: true,
    hasRemoteCollector: true
  });

  assert.equal(target, 'remote');
});

test('resolveMonitorTarget falls back to local in a remote window without a remote collector', () => {
  const target = resolveMonitorTarget({
    isRemoteWindow: true,
    hasRemoteCollector: false
  });

  assert.equal(target, 'local');
});

test('resolveMonitorTarget returns local in a local window', () => {
  const target = resolveMonitorTarget({
    isRemoteWindow: false,
    hasRemoteCollector: true
  });

  assert.equal(target, 'local');
});
