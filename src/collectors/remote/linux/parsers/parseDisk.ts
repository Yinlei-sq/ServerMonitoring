import type { DiskSummary } from '../../../../shared/types.ts';

const kibibyte = 1024;

export function parseDfOutput(stdout: string): DiskSummary[] {
  const lines = stdout.trim().split(/\r?\n/);
  const disks: DiskSummary[] = [];

  for (const line of lines.slice(1)) {
    const match = line.match(/^(\S+)\s+(\d+)\s+(\d+)\s+\d+\s+(\d+)%\s+(.+)$/);
    if (!match) {
      continue;
    }

    const totalBlocks = Number(match[2]);
    const usedBlocks = Number(match[3]);
    const usagePercent = Number(match[4]);

    disks.push({
      mount: match[5],
      totalBytes: totalBlocks * kibibyte,
      usedBytes: usedBlocks * kibibyte,
      usagePercent
    });
  }

  if (disks.length === 0) {
    throw new Error('failed to parse df output');
  }

  return disks;
}
