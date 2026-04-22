import { collectPosixDisks, createOverviewCollector } from '../common/overviewCollector.ts';
import type { PlatformCollectorOptions, SnapshotCollector } from '../common/overviewCollector.ts';
import type { MonitorSnapshot } from '../../../shared/types.ts';

export function createMacosCollector(options: PlatformCollectorOptions = {}): SnapshotCollector {
  return createOverviewCollector({
    probes: options.probes,
    readDisks: collectPosixDisks
  });
}

export async function collectMacSnapshot(
  options: PlatformCollectorOptions = {}
): Promise<MonitorSnapshot> {
  return createMacosCollector(options).collect();
}
