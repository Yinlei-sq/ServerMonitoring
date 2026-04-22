import assert from 'node:assert/strict';
import test from 'node:test';

import type { ModuleState } from '../../src/shared/types.ts';

const okState: ModuleState<number> = { status: 'ok', data: 1 };

// @ts-expect-error - ok states must carry a payload
const missingPayload: ModuleState<number> = { status: 'ok' };

// @ts-expect-error - failure states must not accept payload data
const failureWithPayload: ModuleState<number> = { status: 'unsupported', data: 1 };

test('module state type constraints are represented', () => {
  assert.equal(okState.status, 'ok');
});
