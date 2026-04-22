import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const testsDir = path.join(rootDir, 'tests');

async function collectTests(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectTests(fullPath));
      continue;
    }

    if (/\.(test|spec)\.(ts|js|mts|cts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = await collectTests(testsDir);

if (files.length === 0) {
  console.error('No test files found under tests/**');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', '--test-isolation=none', ...files], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
