import type { MonitorSnapshot, MonitorTarget } from '../shared/types.ts';

export interface SnapshotCollector {
  collect(): Promise<MonitorSnapshot>;
}

export interface MonitorControllerOptions {
  localCollector: SnapshotCollector;
  remoteCollector?: SnapshotCollector;
  getTarget: () => MonitorTarget;
}

export class MonitorController {
  private readonly options: MonitorControllerOptions;
  private latestSnapshot?: MonitorSnapshot;

  constructor(options: MonitorControllerOptions) {
    this.options = options;
  }

  getLatestSnapshot(): MonitorSnapshot | undefined {
    return this.latestSnapshot;
  }

  async refreshOverview(): Promise<MonitorSnapshot> {
    const target = this.options.getTarget();
    const collector =
      target === 'remote'
        ? this.options.remoteCollector
        : this.options.localCollector;

    if (!collector) {
      throw new Error('Remote collector is not available for the current remote target.');
    }

    this.latestSnapshot = await collector.collect();
    return this.latestSnapshot;
  }
}
