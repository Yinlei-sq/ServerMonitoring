import assert from 'node:assert/strict';
import test from 'node:test';

import { RemoteLinuxCollector } from '../../../../src/collectors/remote/linux/remoteLinuxCollector.ts';

function createCollector(responses: Record<string, string>) {
  return new RemoteLinuxCollector({
    now: () => new Date('2026-04-18T08:00:00.000Z'),
    sampleDelayMs: 0,
    runCommand: async (command, args) => {
      const key = [command, ...(args ?? [])].join(' ');
      const response = responses[key];
      if (response === undefined) {
        const error = new Error(`missing response for ${key}`) as Error & { code?: string };
        error.code = 'ENOENT';
        throw error;
      }

      return response;
    }
  });
}

test('RemoteLinuxCollector returns a remote overview snapshot', async () => {
  const collector = createCollector({
    'hostname': 'remote-host\n',
    'uname -s': 'Linux\n',
    'uname -m': 'x86_64\n',
    'cat /proc/uptime': '12345.67 54321.00\n',
    'cat /proc/stat': [
      'cpu  100 0 100 800 0 0 0 0 0 0',
      'cpu  160 0 140 840 0 0 0 0 0 0'
    ].join('\n'),
    'nproc': '8\n',
    'cat /proc/loadavg': '0.10 0.20 0.30 1/123 4567\n',
    'cat /proc/meminfo': [
      'MemTotal:       16384256 kB',
      'MemAvailable:    8192128 kB'
    ].join('\n'),
    'df -kP': [
      'Filesystem     1024-blocks      Used Available Capacity Mounted on',
      '/dev/sda1        100000000 25000000  75000000      25% /'
    ].join('\n'),
    'nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits':
      [
        '0, NVIDIA A100-SXM4-40GB, 12, 1024, 40960'
      ].join('\n'),
    'ps -eo pid,user,%cpu,%mem,comm --no-headers': [
      '1234 alice 3.2 1.1 node'
    ].join('\n')
  });

  const snapshot = await collector.collect();

  assert.equal(snapshot.target, 'remote');
  assert.equal(snapshot.host.hostname, 'remote-host');
  assert.equal(snapshot.host.platform, 'Linux');
  assert.equal(snapshot.host.arch, 'x86_64');
  assert.equal(snapshot.host.uptimeSeconds, 12345.67);
  assert.equal(snapshot.host.updatedAt, '2026-04-18T08:00:00.000Z');
  assert.equal(snapshot.cpu.status, 'ok');
  assert.equal(snapshot.memory.status, 'ok');
  assert.equal(snapshot.disks.status, 'ok');
  assert.equal(snapshot.gpus.status, 'ok');
  assert.equal(snapshot.processes.status, 'ok');
  assert.equal(snapshot.processes.data[0].pid, 1234);
  assert.equal(snapshot.processes.data[0].user, 'alice');
  assert.equal(snapshot.processes.data[0].name, 'node');
});

test('RemoteLinuxCollector degrades optional modules when GPU commands are missing', async () => {
  const collector = createCollector({
    'hostname': 'remote-host\n',
    'uname -s': 'Linux\n',
    'uname -m': 'x86_64\n',
    'cat /proc/uptime': '12345.67 54321.00\n',
    'cat /proc/stat': [
      'cpu  100 0 100 800 0 0 0 0 0 0',
      'cpu  160 0 140 840 0 0 0 0 0 0'
    ].join('\n'),
    'nproc': '8\n',
    'cat /proc/loadavg': '0.10 0.20 0.30 1/123 4567\n',
    'cat /proc/meminfo': [
      'MemTotal:       16384256 kB',
      'MemAvailable:    8192128 kB'
    ].join('\n'),
    'df -kP': [
      'Filesystem     1024-blocks      Used Available Capacity Mounted on',
      '/dev/sda1        100000000 25000000  75000000      25% /'
    ].join('\n'),
    'ps -eo pid,user,%cpu,%mem,comm --no-headers': [
      '1234 alice 3.2 1.1 node'
    ].join('\n')
  });

  const snapshot = await collector.collect();

  assert.equal(snapshot.gpus.status, 'unsupported');
  assert.equal(snapshot.disks.status, 'ok');
});

test('RemoteLinuxCollector marks malformed gpu and process output as failed modules', async () => {
  const collector = createCollector({
    'hostname': 'remote-host\n',
    'uname -s': 'Linux\n',
    'uname -m': 'x86_64\n',
    'cat /proc/uptime': '12345.67 54321.00\n',
    'cat /proc/stat': [
      'cpu  100 0 100 800 0 0 0 0 0 0',
      'cpu  160 0 140 840 0 0 0 0 0 0'
    ].join('\n'),
    'nproc': '8\n',
    'cat /proc/loadavg': '0.10 0.20 0.30 1/123 4567\n',
    'cat /proc/meminfo': [
      'MemTotal:       16384256 kB',
      'MemAvailable:    8192128 kB'
    ].join('\n'),
    'df -kP': [
      'Filesystem     1024-blocks      Used Available Capacity Mounted on',
      '/dev/sda1        100000000 25000000  75000000      25% /'
    ].join('\n'),
    'nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total --format=csv,noheader,nounits':
      'bad,row\n',
    'ps -eo pid,user,%cpu,%mem,comm --no-headers': 'bad row\n'
  });

  const snapshot = await collector.collect();

  assert.equal(snapshot.gpus.status, 'commandFailed');
  assert.equal(snapshot.processes.status, 'commandFailed');
});

test('RemoteLinuxCollector uses safe remote host fallbacks when host commands fail', async () => {
  const collector = new RemoteLinuxCollector({
    now: () => new Date('2026-04-18T08:00:00.000Z'),
    sampleDelayMs: 0,
    runCommand: async (command, args) => {
      const key = [command, ...(args ?? [])].join(' ');

      if (key === 'hostname' || key === 'uname -s' || key === 'uname -m' || key === 'cat /proc/uptime') {
        const error = new Error(`missing response for ${key}`) as Error & { code?: string };
        error.code = 'ENOENT';
        throw error;
      }

      if (key === 'cat /proc/stat') {
        return [
          'cpu  100 0 100 800 0 0 0 0 0 0',
          'cpu  160 0 140 840 0 0 0 0 0 0'
        ].join('\n');
      }

      if (key === 'cat /proc/loadavg') {
        return '0.10 0.20 0.30 1/123 4567\n';
      }

      if (key === 'nproc') {
        return '8\n';
      }

      if (key === 'cat /proc/meminfo') {
        return [
          'MemTotal:       16384256 kB',
          'MemAvailable:    8192128 kB'
        ].join('\n');
      }

      if (key === 'df -kP') {
        return [
          'Filesystem     1024-blocks      Used Available Capacity Mounted on',
          '/dev/sda1        100000000 25000000  75000000      25% /'
        ].join('\n');
      }

      if (key === 'ps -eo pid,user,%cpu,%mem,comm --no-headers') {
        return '1234 alice 3.2 1.1 node\n';
      }

      const error = new Error(`missing response for ${key}`) as Error & { code?: string };
      error.code = 'ENOENT';
      throw error;
    }
  });

  const snapshot = await collector.collect();

  assert.equal(snapshot.host.hostname, '');
  assert.equal(snapshot.host.platform, 'Linux');
  assert.equal(snapshot.host.arch, '');
  assert.equal(snapshot.host.uptimeSeconds, 0);
  assert.equal(snapshot.cpu.status, 'ok');
  assert.equal(snapshot.memory.status, 'ok');
  assert.equal(snapshot.processes.status, 'ok');
});
