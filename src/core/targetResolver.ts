import type { TargetResolutionInput } from '../shared/protocol.ts';
import type { MonitorTarget } from '../shared/types.ts';

export function resolveMonitorTarget(input: TargetResolutionInput): MonitorTarget {
  return input.isRemoteWindow && input.hasRemoteCollector ? 'remote' : 'local';
}
