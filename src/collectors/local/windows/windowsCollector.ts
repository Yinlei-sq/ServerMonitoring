import { createOverviewCollector } from '../common/overviewCollector.ts';
import type { PlatformCollectorOptions, SnapshotCollector } from '../common/overviewCollector.ts';
import type { MonitorSnapshot } from '../../../shared/types.ts';

export function createWindowsCollector(options: PlatformCollectorOptions = {}): SnapshotCollector {
  return createOverviewCollector({
    probes: options.probes
  });
}

export async function collectWindowsSnapshot(
  options: PlatformCollectorOptions = {}
): Promise<MonitorSnapshot> {
  return createWindowsCollector(options).collect();
}
