import assert from 'node:assert/strict';
import test from 'node:test';

import type { MonitorSnapshot } from '../../src/shared/types.ts';

const cpu: MonitorSnapshot['cpu'] = {
  status: 'ok',
  data: {
    usagePercent: 12.5,
    cores: 8,
    load: [1, 2, 3]
  }
};

const memory: MonitorSnapshot['memory'] = {
  status: 'ok',
  data: {
    usedBytes: 100,
    freeBytes: 200,
    totalBytes: 300,
    usagePercent: 33.3
  }
};

const disks: MonitorSnapshot['disks'] = {
  status: 'ok',
  data: [
    {
      mount: 'C:/',
      usedBytes: 50,
      totalBytes: 100,
      usagePercent: 50
    }
  ]
};

const network: MonitorSnapshot['network'] = {
  status: 'ok',
  data: {
    rxBytesPerSecond: 10,
    txBytesPerSecond: 20
  }
};

const gpus: MonitorSnapshot['gpus'] = {
  status: 'ok',
  data: [
    {
      index: 0,
      name: 'GPU',
      usagePercent: 70,
      memoryUsedMb: 1024,
      memoryTotalMb: 2048
    }
  ]
};

const processes: MonitorSnapshot['processes'] = {
  status: 'ok',
  data: [
    {
      pid: 1234,
      name: 'node',
      cpuPercent: 3.2,
      memoryPercent: 1.1,
      user: 'alice',
      command: 'node app.js'
    }
  ]
};

// @ts-expect-error - cpu payload should reject arbitrary shapes
const invalidCpu: MonitorSnapshot['cpu'] = { status: 'ok', data: { wrong: true } };

test('monitor snapshot payload types are concrete', () => {
  assert.equal(cpu.data.cores, 8);
  assert.equal(memory.data.totalBytes, 300);
  assert.equal(disks.data[0].mount, 'C:/');
  assert.equal(network.data.rxBytesPerSecond, 10);
  assert.equal(gpus.data[0].index, 0);
  assert.equal(processes.data[0].pid, 1234);
});
