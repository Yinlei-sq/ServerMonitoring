import type { GpuSummary } from '../../../../shared/types.ts';

export function parseNvidiaSmiCsv(stdout: string): GpuSummary[] {
  const gpus: GpuSummary[] = [];
  const trimmed = stdout.trim();
  const lines = trimmed.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const parts = line.split(',').map((part) => part.trim());
    if (parts.length < 5) {
      continue;
    }

    const [indexText, name, usageText, usedText, totalText] = parts;
    const index = Number(indexText);
    const usagePercent = Number(usageText);
    const memoryUsedMb = Number(usedText);
    const memoryTotalMb = Number(totalText);

    if (
      !Number.isInteger(index) ||
      Number.isNaN(usagePercent) ||
      Number.isNaN(memoryUsedMb) ||
      Number.isNaN(memoryTotalMb) ||
      !name
    ) {
      continue;
    }

    gpus.push({
      index,
      name,
      usagePercent,
      memoryUsedMb,
      memoryTotalMb
    });
  }

  if (trimmed.length > 0 && gpus.length === 0) {
    throw new Error('failed to parse nvidia-smi csv output');
  }

  return gpus;
}
