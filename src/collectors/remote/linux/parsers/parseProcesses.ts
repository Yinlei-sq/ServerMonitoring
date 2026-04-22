import type { ProcessSummary } from '../../../../shared/types.ts';

export function parsePsOutput(stdout: string): ProcessSummary[] {
  const processes: ProcessSummary[] = [];
  const trimmed = stdout.trim();
  const lines = trimmed.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(\S+)\s+([0-9.]+)\s+([0-9.]+)\s+(.+)$/);
    if (!match) {
      continue;
    }

    const pid = Number(match[1]);
    const cpuPercent = Number(match[3]);
    const memoryPercent = Number(match[4]);
    const name = match[5].trim();

    if (!Number.isInteger(pid) || Number.isNaN(cpuPercent) || Number.isNaN(memoryPercent) || !name) {
      continue;
    }

    processes.push({
      pid,
      user: match[2],
      cpuPercent,
      memoryPercent,
      name
    });
  }

  if (trimmed.length > 0 && processes.length === 0) {
    throw new Error('failed to parse ps output');
  }

  return processes;
}
