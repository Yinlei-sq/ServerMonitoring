import { createOverviewCollector } from '../common/overviewCollector.ts';
import { collectPosixDisks } from '../common/overviewCollector.ts';
import type { PlatformCollectorOptions, SnapshotCollector } from '../common/overviewCollector.ts';
import type { MonitorSnapshot } from '../../../shared/types.ts';

export function createLinuxCollector(options: PlatformCollectorOptions = {}): SnapshotCollector {
  return createOverviewCollector({
    probes: options.probes,
    readDisks: collectPosixDisks
  });
}

export async function collectLinuxSnapshot(
  options: PlatformCollectorOptions = {}
): Promise<MonitorSnapshot> {
  return createLinuxCollector(options).collect();
}
