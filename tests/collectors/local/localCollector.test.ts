import assert from 'node:assert/strict';
import test from 'node:test';

import { createOverviewCollector } from '../../../src/collectors/local/common/overviewCollector.ts';
import { createLocalCollector } from '../../../src/collectors/local/index.ts';
import { createLinuxCollector } from '../../../src/collectors/local/linux/linuxCollector.ts';
import { createMacosCollector } from '../../../src/collectors/local/macos/macosCollector.ts';
import { createWindowsCollector } from '../../../src/collectors/local/windows/windowsCollector.ts';
import { emptySnapshot } from '../../../src/shared/types.ts';

test('local collector factory selects the expected platform collector', async () => {
  const cases = [
    { platform: 'win32', expected: 'windows' },
    { platform: 'darwin', expected: 'macos' },
    { platform: 'linux', expected: 'linux' }
  ] as const;

  for (const testCase of cases) {
    let windowsCalls = 0;
    let macosCalls = 0;
    let linuxCalls = 0;

    const collector = createLocalCollector({
      platform: testCase.platform,
      windowsCollector: {
        collect: async () => {
          windowsCalls += 1;
          return emptySnapshot('local');
        }
      },
      macosCollector: {
        collect: async () => {
          macosCalls += 1;
          return emptySnapshot('local');
        }
      },
      linuxCollector: {
        collect: async () => {
          linuxCalls += 1;
          return emptySnapshot('local');
        }
      }
    });

    await collector.collect();

    assert.equal(windowsCalls, testCase.expected === 'windows' ? 1 : 0);
    assert.equal(macosCalls, testCase.expected === 'macos' ? 1 : 0);
    assert.equal(linuxCalls, testCase.expected === 'linux' ? 1 : 0);
  }
});

test('local collector falls back safely on an unknown platform', async () => {
  let windowsCalls = 0;
  let macosCalls = 0;
  let linuxCalls = 0;

  const collector = createLocalCollector({
    platform: 'sunos',
    windowsCollector: {
      collect: async () => {
        windowsCalls += 1;
        return emptySnapshot('local');
      }
    },
    macosCollector: {
      collect: async () => {
        macosCalls += 1;
        return emptySnapshot('local');
      }
    },
    linuxCollector: {
      collect: async () => {
        linuxCalls += 1;
        const snapshot = emptySnapshot('local');
        snapshot.host.hostname = 'linux-path';
        return snapshot;
      }
    }
  });

  const snapshot = await collector.collect();

  assert.equal(windowsCalls, 0);
  assert.equal(macosCalls, 0);
  assert.equal(linuxCalls, 0);
  assert.equal(snapshot.target, 'local');
  assert.notEqual(snapshot.host.hostname, 'linux-path');
});

test('local collector populates host, cpu, and memory on the current platform path', async () => {
  const probes = {
    hostname: () => 'test-host',
    platform: () => process.platform,
    arch: () => 'x64',
    uptimeSeconds: () => 1234,
    now: () => new Date('2026-04-18T00:00:00.000Z'),
    cpuUsagePercent: async () => 37.5,
    loadAverage: () => [1.1, 0.9, 0.7] as [number, number, number],
    cpuCount: () => 8,
    totalMemoryBytes: () => 16 * 1024 * 1024,
    freeMemoryBytes: () => 4 * 1024 * 1024
  };

  const collector =
    process.platform === 'win32'
      ? createWindowsCollector({ probes })
      : process.platform === 'darwin'
        ? createMacosCollector({ probes })
        : createLinuxCollector({ probes });

  const snapshot = await collector.collect();

  assert.equal(snapshot.target, 'local');
  assert.equal(snapshot.host.hostname, 'test-host');
  assert.equal(snapshot.host.platform, process.platform);
  assert.equal(snapshot.host.arch, 'x64');
  assert.equal(snapshot.host.uptimeSeconds, 1234);
  assert.equal(snapshot.host.updatedAt, '2026-04-18T00:00:00.000Z');
  assert.equal(snapshot.cpu.status, 'ok');
  assert.equal(snapshot.memory.status, 'ok');

  if (snapshot.cpu.status !== 'ok' || snapshot.memory.status !== 'ok') {
    throw new Error('Expected cpu and memory modules to be populated');
  }

  assert.equal(snapshot.cpu.data.usagePercent, 37.5);
  assert.equal(snapshot.cpu.data.cores, 8);
  assert.deepEqual(snapshot.cpu.data.load, [1.1, 0.9, 0.7]);
  assert.equal(snapshot.memory.data.totalBytes, 16 * 1024 * 1024);
  assert.equal(snapshot.memory.data.freeBytes, 4 * 1024 * 1024);
  assert.equal(snapshot.memory.data.usedBytes, 12 * 1024 * 1024);
  assert.equal(snapshot.memory.data.usagePercent, 75);
});

test('overview collector degrades cpu, memory, and disk failures into module states', async () => {
  const collector = createOverviewCollector({
    probes: {
      hostname: () => 'probe-host',
      platform: () => 'test-platform',
      arch: () => 'x64',
      uptimeSeconds: () => 42,
      now: () => new Date('2026-04-18T00:00:00.000Z'),
      cpuCount: () => 8,
      loadAverage: () => [0.1, 0.2, 0.3] as [number, number, number],
      cpuUsagePercent: async () => {
        throw new Error('cpu probe failed');
      },
      totalMemoryBytes: () => {
        throw new Error('memory probe failed');
      },
      freeMemoryBytes: () => 0
    },
    readDisks: async () => {
      const error = new Error('permission denied');
      (error as NodeJS.ErrnoException).code = 'EPERM';
      throw error;
    }
  });

  const snapshot = await collector.collect();

  assert.equal(snapshot.host.hostname, 'probe-host');
  assert.equal(snapshot.cpu.status, 'commandFailed');
  assert.equal(snapshot.memory.status, 'commandFailed');
  assert.equal(snapshot.disks.status, 'permissionDenied');
});
