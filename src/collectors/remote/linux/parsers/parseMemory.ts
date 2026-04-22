export interface MemoryInfo {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
}

const kibibyte = 1024;

export function parseMemoryInfo(stdout: string): MemoryInfo {
  const lines = stdout.trim().split(/\r?\n/);
  const entries = new Map<string, number>();

  for (const line of lines) {
    const match = line.match(/^([^:]+):\s+(\d+)\s+kB$/);
    if (!match) {
      continue;
    }

    entries.set(match[1], Number(match[2]) * kibibyte);
  }

  const totalBytes = entries.get('MemTotal');
  const freeBytes = entries.get('MemAvailable') ?? entries.get('MemFree');

  if (totalBytes === undefined || freeBytes === undefined) {
    throw new Error('failed to parse memory info output');
  }

  const usedBytes = Math.max(totalBytes - freeBytes, 0);

  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0
  };
}
