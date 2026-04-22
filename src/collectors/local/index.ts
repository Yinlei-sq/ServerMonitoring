import os from 'node:os';

import type { MonitorSnapshot } from '../../shared/types.ts';
import { createOverviewCollector } from './common/overviewCollector.ts';
import type { SnapshotCollector } from './common/overviewCollector.ts';
import { createLinuxCollector } from './linux/linuxCollector.ts';
import { createMacosCollector } from './macos/macosCollector.ts';
import { createWindowsCollector } from './windows/windowsCollector.ts';

export interface LocalCollectorFactoryOptions {
  platform?: NodeJS.Platform;
  windowsCollector?: SnapshotCollector;
  macosCollector?: SnapshotCollector;
  linuxCollector?: SnapshotCollector;
}

export function createLocalCollector(
  options: LocalCollectorFactoryOptions = {}
): SnapshotCollector {
  const platform = options.platform ?? os.platform();

  switch (platform) {
    case 'win32':
      return options.windowsCollector ?? createWindowsCollector();
    case 'darwin':
      return options.macosCollector ?? createMacosCollector();
    case 'linux':
      return options.linuxCollector ?? createLinuxCollector();
    default:
      return createOverviewCollector();
  }
}

export async function collectLocalSnapshot(): Promise<MonitorSnapshot> {
  return createLocalCollector().collect();
}
