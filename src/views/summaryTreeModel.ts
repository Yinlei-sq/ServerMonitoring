import type { MonitorSnapshot, ModuleState, ProcessSummary } from '../shared/types.ts';

export interface SummaryRow {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  contextValue?: string;
  action?: {
    type: 'killProcess';
    pid: number;
  };
}

export function buildSummaryRows(snapshot: MonitorSnapshot | undefined): SummaryRow[] {
  if (!snapshot) {
    return [
      {
        id: 'empty',
        label: 'No data yet',
        description: 'Run refresh to load a monitor snapshot.'
      }
    ];
  }

  const rows: SummaryRow[] = [
    {
      id: 'target',
      label: 'Target',
      description: snapshot.target === 'remote' ? 'Remote' : 'Local'
    },
    {
      id: 'host',
      label: 'Host',
      description: snapshot.host.hostname || 'Unknown'
    },
    {
      id: 'cpu',
      label: 'CPU',
      description: describeCpu(snapshot.cpu)
    },
    {
      id: 'memory',
      label: 'Memory',
      description: describeMemory(snapshot.memory)
    }
  ];

  const topProcess = getTopProcess(snapshot.processes);
  if (topProcess) {
    rows.push({
      id: `process-${topProcess.pid}`,
      label: 'Top Process',
      description: `${topProcess.name} (${topProcess.pid}) ${formatPercent(topProcess.cpuPercent)} CPU`,
      tooltip: topProcess.command ?? topProcess.name,
      contextValue: snapshot.capabilities.canKillProcess ? 'killableProcess' : 'process',
      action: snapshot.capabilities.canKillProcess
        ? {
            type: 'killProcess',
            pid: topProcess.pid
          }
        : undefined
    });
  }

  rows.push({
    id: 'updatedAt',
    label: 'Updated',
    description: formatUpdatedAt(snapshot.host.updatedAt)
  });

  return rows;
}

function describeCpu(cpu: MonitorSnapshot['cpu']): string {
  if (cpu.status !== 'ok') {
    return describeUnavailable(cpu);
  }

  return `${formatPercent(cpu.data.usagePercent)} - ${cpu.data.cores} cores`;
}

function describeMemory(memory: MonitorSnapshot['memory']): string {
  if (memory.status !== 'ok') {
    return describeUnavailable(memory);
  }

  return `${formatBytes(memory.data.usedBytes)} / ${formatBytes(memory.data.totalBytes)}`;
}

function describeUnavailable(module: ModuleState): string {
  switch (module.status) {
    case 'permissionDenied':
      return 'Permission denied';
    case 'commandFailed':
      return 'Command failed';
    case 'unsupported':
    default:
      return 'Unsupported';
  }
}

function getTopProcess(processes: MonitorSnapshot['processes']): ProcessSummary | undefined {
  if (processes.status !== 'ok' || processes.data.length === 0) {
    return undefined;
  }

  return [...processes.data].sort((left, right) => right.cpuPercent - left.cpuPercent)[0];
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatBytes(value: number): string {
  const gib = value / 1024 ** 3;
  return `${gib.toFixed(1)} GB`;
}

function formatUpdatedAt(updatedAt: string): string {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) {
    return 'Unknown';
  }

  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}
