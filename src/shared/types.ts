export type MonitorTarget = 'local' | 'remote';

export type SnapshotTarget = MonitorTarget;

export type ModuleStatus = 'ok' | 'unsupported' | 'permissionDenied' | 'commandFailed';

type ModuleFailureStatus = Exclude<ModuleStatus, 'ok'>;

export type ModuleState<T = unknown> =
  | {
      status: 'ok';
      data: T;
    }
  | {
      status: ModuleFailureStatus;
      data?: never;
    };

export interface CpuSummary {
  usagePercent: number;
  cores: number;
  load: [number, number, number];
}

export interface MemorySummary {
  usedBytes: number;
  freeBytes: number;
  totalBytes: number;
  usagePercent: number;
}

export interface DiskSummary {
  mount: string;
  usedBytes: number;
  totalBytes: number;
  usagePercent: number;
}

export interface NetworkSummary {
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

export interface GpuSummary {
  index: number;
  name: string;
  usagePercent: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
}

export interface ProcessSummary {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryPercent: number;
  user?: string;
  command?: string;
}

export interface HostSummary {
  hostname: string;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  updatedAt: string;
}

export interface CapabilitySummary {
  canKillProcess: boolean;
  canRunCustomCommand: boolean;
  canClearCache: boolean;
  canRefreshEnvironment: boolean;
}

export interface MonitorSnapshot {
  target: MonitorTarget;
  host: HostSummary;
  capabilities: CapabilitySummary;
  cpu: ModuleState<CpuSummary>;
  memory: ModuleState<MemorySummary>;
  disks: ModuleState<DiskSummary[]>;
  network: ModuleState<NetworkSummary>;
  gpus: ModuleState<GpuSummary[]>;
  processes: ModuleState<ProcessSummary[]>;
}

const unsupportedModule = { status: 'unsupported' } satisfies ModuleState<never>;

export function emptySnapshot(target: MonitorTarget): MonitorSnapshot {
  return {
    target,
    host: {
      hostname: '',
      platform: '',
      arch: '',
      uptimeSeconds: 0,
      updatedAt: new Date(0).toISOString()
    },
    capabilities: {
      canKillProcess: false,
      canRunCustomCommand: false,
      canClearCache: false,
      canRefreshEnvironment: false
    },
    cpu: { ...unsupportedModule },
    memory: { ...unsupportedModule },
    disks: { ...unsupportedModule },
    network: { ...unsupportedModule },
    gpus: { ...unsupportedModule },
    processes: { ...unsupportedModule }
  };
}
