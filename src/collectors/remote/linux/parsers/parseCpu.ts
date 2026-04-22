export interface CpuStatSample {
  total: number;
  idle: number;
}

export function parseLoadAverage(stdout: string): [number, number, number] {
  const line = stdout.trim().split(/\r?\n/).find((entry) => entry.trim().length > 0);
  if (!line) {
    throw new Error('missing load average output');
  }

  const values = line.trim().split(/\s+/);
  if (values.length < 3) {
    throw new Error('failed to parse load average output');
  }

  const parsed = values.slice(0, 3).map((value) => Number(value));
  if (parsed.some((value) => Number.isNaN(value))) {
    throw new Error('failed to parse load average output');
  }

  return [parsed[0], parsed[1], parsed[2]];
}

export function parseCpuStatSample(stdout: string): CpuStatSample {
  const line = stdout
    .trim()
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('cpu '));

  if (!line) {
    throw new Error('missing cpu stat output');
  }

  const values = line.trim().split(/\s+/).slice(1).map((value) => Number(value));
  if (values.length < 4 || values.some((value) => Number.isNaN(value))) {
    throw new Error('failed to parse cpu stat output');
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  const idle = (values[3] ?? 0) + (values[4] ?? 0);

  return { total, idle };
}

export function calculateCpuUsagePercent(previous: CpuStatSample, current: CpuStatSample): number {
  const totalDiff = current.total - previous.total;
  const idleDiff = current.idle - previous.idle;

  if (totalDiff <= 0) {
    return 0;
  }

  return Number((((totalDiff - idleDiff) / totalDiff) * 100).toFixed(1));
}

export function parseCpuCoreCount(stdout: string): number {
  const value = Number(stdout.trim());
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('failed to parse cpu core count');
  }

  return Math.trunc(value);
}
