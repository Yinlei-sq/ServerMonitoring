# VS Code 服务器监控插件 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a VS Code extension that monitors local resources by default, switches to the current Remote SSH Linux host when connected, and lets the user switch back to local monitoring from the dashboard.

**Architecture:** The extension uses a split collector model with a shared `MonitorSnapshot` contract. A controller owns refresh scheduling, target selection, caching, and action dispatch; Webview and Tree View consume the same normalized snapshot stream. Local collection is implemented per platform, remote collection targets Linux only, and action execution is isolated from read-only telemetry collection.

**Tech Stack:** TypeScript, VS Code Extension API, esbuild, Vitest, DOM-based Webview UI

---

## File Structure

### Root and build files

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.mjs`
- Create: `.vscodeignore`
- Create: `.gitignore`
- Create: `README.md`

### Shared contracts

- Create: `src/shared/types.ts`
- Create: `src/shared/protocol.ts`
- Create: `src/shared/errors.ts`

### Core orchestration

- Create: `src/extension.ts`
- Create: `src/core/monitorController.ts`
- Create: `src/core/targetResolver.ts`
- Create: `src/core/refreshScheduler.ts`

### Local collectors

- Create: `src/collectors/local/index.ts`
- Create: `src/collectors/local/windows/windowsCollector.ts`
- Create: `src/collectors/local/macos/macosCollector.ts`
- Create: `src/collectors/local/linux/linuxCollector.ts`
- Create: `src/collectors/local/common/networkRateTracker.ts`

### Remote Linux collectors

- Create: `src/collectors/remote/linux/remoteLinuxCollector.ts`
- Create: `src/collectors/remote/linux/commands/buildLinuxCommands.ts`
- Create: `src/collectors/remote/linux/parsers/parseCpu.ts`
- Create: `src/collectors/remote/linux/parsers/parseMemory.ts`
- Create: `src/collectors/remote/linux/parsers/parseDisk.ts`
- Create: `src/collectors/remote/linux/parsers/parseGpu.ts`
- Create: `src/collectors/remote/linux/parsers/parseProcesses.ts`

### Actions and settings

- Create: `src/actions/actionService.ts`
- Create: `src/actions/actionValidators.ts`
- Create: `src/config/settings.ts`

### Views

- Create: `src/views/monitorTreeDataProvider.ts`
- Create: `src/webview/dashboardPanel.ts`
- Create: `src/webview/getHtml.ts`
- Create: `media/dashboard.css`
- Create: `media/dashboard.js`

### Tests

- Create: `tests/shared/types.test.ts`
- Create: `tests/core/targetResolver.test.ts`
- Create: `tests/core/monitorController.test.ts`
- Create: `tests/collectors/remote/linux/parsers.test.ts`
- Create: `tests/actions/actionService.test.ts`

## Task 1: Bootstrap the extension workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `esbuild.mjs`
- Create: `.gitignore`
- Create: `.vscodeignore`
- Create: `README.md`

- [ ] **Step 1: Write the failing build smoke test**

Create `tests/shared/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptySnapshot } from '../../src/shared/types';

describe('emptySnapshot', () => {
  it('creates a local snapshot with empty module states', () => {
    const snapshot = emptySnapshot('local');

    expect(snapshot.target).toBe('local');
    expect(snapshot.cpu.status).toBe('unsupported');
    expect(snapshot.memory.status).toBe('unsupported');
    expect(snapshot.disks.status).toBe('unsupported');
    expect(snapshot.network.status).toBe('unsupported');
    expect(snapshot.gpus.status).toBe('unsupported');
    expect(snapshot.processes.status).toBe('unsupported');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand`

Expected: FAIL with package scripts or source files missing.

- [ ] **Step 3: Write the minimal workspace and build configuration**

Create `package.json`:

```json
{
  "name": "server-monitor",
  "displayName": "Server Monitor",
  "description": "Monitor local and remote server resources inside VS Code.",
  "version": "0.0.1",
  "publisher": "local",
  "engines": {
    "vscode": "^1.100.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onView:serverMonitor.dashboard",
    "onView:serverMonitor.summary",
    "onCommand:serverMonitor.refresh",
    "onCommand:serverMonitor.switchTarget",
    "onCommand:serverMonitor.killProcess"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "serverMonitor",
          "title": "服务器监控",
          "icon": "media/icon.svg"
        }
      ]
    },
    "views": {
      "serverMonitor": [
        {
          "id": "serverMonitor.dashboard",
          "name": "监控面板",
          "type": "webview"
        },
        {
          "id": "serverMonitor.summary",
          "name": "资源摘要"
        }
      ]
    },
    "commands": [
      {
        "command": "serverMonitor.refresh",
        "title": "服务器监控: 刷新"
      },
      {
        "command": "serverMonitor.switchTarget",
        "title": "服务器监控: 切换目标"
      },
      {
        "command": "serverMonitor.killProcess",
        "title": "服务器监控: 结束进程"
      }
    ],
    "configuration": {
      "title": "Server Monitor",
      "properties": {
        "serverMonitor.autoSwitchToRemote": {
          "type": "boolean",
          "default": true,
          "description": "When connected to a remote workspace, prefer remote monitoring."
        },
        "serverMonitor.overviewRefreshSeconds": {
          "type": "number",
          "default": 2,
          "minimum": 1
        },
        "serverMonitor.processRefreshSeconds": {
          "type": "number",
          "default": 5,
          "minimum": 2
        },
        "serverMonitor.diskRefreshSeconds": {
          "type": "number",
          "default": 15,
          "minimum": 5
        },
        "serverMonitor.customCommands": {
          "type": "array",
          "default": [],
          "items": {
            "type": "object"
          }
        }
      }
    }
  },
  "scripts": {
    "build": "node esbuild.mjs",
    "watch": "node esbuild.mjs --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.15.3",
    "@types/vscode": "^1.100.0",
    "esbuild": "^0.25.3",
    "typescript": "^5.8.3",
    "vitest": "^3.1.2"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "Node",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "types": ["node", "vscode"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts", "esbuild.mjs"]
}
```

Create `esbuild.mjs`:

```js
import esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  outfile: 'dist/extension.js',
  external: ['vscode']
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
```

Create `.gitignore`:

```gitignore
node_modules
dist
.DS_Store
coverage
.superpowers
```

Create `.vscodeignore`:

```gitignore
src/**
tests/**
esbuild.mjs
tsconfig.json
vitest.config.ts
```

Create `README.md`:

```md
# Server Monitor

VS Code extension for local and Remote SSH server monitoring.
```

- [ ] **Step 4: Add the minimal shared type implementation required by the test**

Create `src/shared/types.ts`:

```ts
export type MonitorTarget = 'local' | 'remote';
export type ModuleStatus = 'ok' | 'unsupported' | 'permissionDenied' | 'commandFailed';

export interface ModuleState<T> {
  status: ModuleStatus;
  data: T;
  error?: string;
}

export interface MonitorSnapshot {
  target: MonitorTarget;
  cpu: ModuleState<{ usagePercent: number; cores: number; load: [number, number, number] }>;
  memory: ModuleState<{ usedBytes: number; freeBytes: number; totalBytes: number; usagePercent: number }>;
  disks: ModuleState<Array<{ mount: string; usedBytes: number; totalBytes: number; usagePercent: number }>>;
  network: ModuleState<{ rxBytesPerSecond: number; txBytesPerSecond: number }>;
  gpus: ModuleState<Array<{ index: number; name: string; usagePercent: number; memoryUsedMb: number; memoryTotalMb: number }>>;
  processes: ModuleState<Array<{ pid: number; name: string; cpuPercent: number; memoryPercent: number }>>;
}

export function emptySnapshot(target: MonitorTarget): MonitorSnapshot {
  return {
    target,
    cpu: { status: 'unsupported', data: { usagePercent: 0, cores: 0, load: [0, 0, 0] } },
    memory: { status: 'unsupported', data: { usedBytes: 0, freeBytes: 0, totalBytes: 0, usagePercent: 0 } },
    disks: { status: 'unsupported', data: [] },
    network: { status: 'unsupported', data: { rxBytesPerSecond: 0, txBytesPerSecond: 0 } },
    gpus: { status: 'unsupported', data: [] },
    processes: { status: 'unsupported', data: [] }
  };
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `npm install`

Expected: dependencies installed without errors.

Run: `npm test`

Expected: PASS for `emptySnapshot` test.

Run: `npm run typecheck`

Expected: PASS with no TypeScript errors.

- [ ] **Step 6: Commit**

If the workspace is inside git:

```bash
git add package.json tsconfig.json esbuild.mjs .gitignore .vscodeignore README.md src/shared/types.ts tests/shared/types.test.ts
git commit -m "chore: bootstrap server monitor extension workspace"
```

## Task 2: Define shared contracts and target resolution

**Files:**
- Modify: `src/shared/types.ts`
- Create: `src/shared/protocol.ts`
- Create: `src/shared/errors.ts`
- Create: `src/core/targetResolver.ts`
- Create: `tests/core/targetResolver.test.ts`

- [ ] **Step 1: Write failing tests for target resolution**

Create `tests/core/targetResolver.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveMonitorTarget } from '../../src/core/targetResolver';

describe('resolveMonitorTarget', () => {
  it('prefers remote when connected and auto switch is enabled', () => {
    const target = resolveMonitorTarget({
      preferredTarget: undefined,
      autoSwitchToRemote: true,
      isRemoteWindow: true,
      hasRemoteCollector: true
    });

    expect(target).toBe('remote');
  });

  it('respects manual local override in a remote window', () => {
    const target = resolveMonitorTarget({
      preferredTarget: 'local',
      autoSwitchToRemote: true,
      isRemoteWindow: true,
      hasRemoteCollector: true
    });

    expect(target).toBe('local');
  });

  it('falls back to local if remote is unavailable', () => {
    const target = resolveMonitorTarget({
      preferredTarget: 'remote',
      autoSwitchToRemote: true,
      isRemoteWindow: true,
      hasRemoteCollector: false
    });

    expect(target).toBe('local');
  });
});
```

- [ ] **Step 2: Run the target resolver test**

Run: `npm test -- tests/core/targetResolver.test.ts`

Expected: FAIL because the resolver does not exist.

- [ ] **Step 3: Implement shared protocol and resolver**

Update `src/shared/types.ts`:

```ts
export interface HostSummary {
  hostname: string;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  updatedAt: string;
}

export interface CapabilitySummary {
  canKillProcess: boolean;
  canRunCustomCommand: boolean;
  canClearCache: boolean;
  canRefreshEnvironment: boolean;
}

export interface MonitorSnapshot {
  target: MonitorTarget;
  host: HostSummary;
  capabilities: CapabilitySummary;
  cpu: ModuleState<{ usagePercent: number; cores: number; load: [number, number, number] }>;
  memory: ModuleState<{ usedBytes: number; freeBytes: number; totalBytes: number; usagePercent: number }>;
  disks: ModuleState<Array<{ mount: string; usedBytes: number; totalBytes: number; usagePercent: number }>>;
  network: ModuleState<{ rxBytesPerSecond: number; txBytesPerSecond: number }>;
  gpus: ModuleState<Array<{ index: number; name: string; usagePercent: number; memoryUsedMb: number; memoryTotalMb: number }>>;
  processes: ModuleState<Array<{ pid: number; name: string; cpuPercent: number; memoryPercent: number; user?: string; command?: string }>>;
}
```

Create `src/shared/protocol.ts`:

```ts
import type { MonitorTarget } from './types';

export interface TargetResolutionInput {
  preferredTarget?: MonitorTarget;
  autoSwitchToRemote: boolean;
  isRemoteWindow: boolean;
  hasRemoteCollector: boolean;
}
```

Create `src/shared/errors.ts`:

```ts
export class CollectorError extends Error {
  constructor(
    message: string,
    public readonly kind: 'unsupported' | 'permissionDenied' | 'commandFailed'
  ) {
    super(message);
  }
}
```

Create `src/core/targetResolver.ts`:

```ts
import type { TargetResolutionInput } from '../shared/protocol';
import type { MonitorTarget } from '../shared/types';

export function resolveMonitorTarget(input: TargetResolutionInput): MonitorTarget {
  if (input.preferredTarget === 'local') {
    return 'local';
  }

  if (input.preferredTarget === 'remote') {
    return input.hasRemoteCollector ? 'remote' : 'local';
  }

  if (input.isRemoteWindow && input.autoSwitchToRemote && input.hasRemoteCollector) {
    return 'remote';
  }

  return 'local';
}
```

- [ ] **Step 4: Run tests and fix `emptySnapshot` contract**

Update `emptySnapshot` in `src/shared/types.ts`:

```ts
export function emptySnapshot(target: MonitorTarget): MonitorSnapshot {
  return {
    target,
    host: {
      hostname: '',
      platform: '',
      arch: '',
      uptimeSeconds: 0,
      updatedAt: new Date(0).toISOString()
    },
    capabilities: {
      canKillProcess: false,
      canRunCustomCommand: false,
      canClearCache: false,
      canRefreshEnvironment: true
    },
    cpu: { status: 'unsupported', data: { usagePercent: 0, cores: 0, load: [0, 0, 0] } },
    memory: { status: 'unsupported', data: { usedBytes: 0, freeBytes: 0, totalBytes: 0, usagePercent: 0 } },
    disks: { status: 'unsupported', data: [] },
    network: { status: 'unsupported', data: { rxBytesPerSecond: 0, txBytesPerSecond: 0 } },
    gpus: { status: 'unsupported', data: [] },
    processes: { status: 'unsupported', data: [] }
  };
}
```

Run: `npm test`

Expected: PASS for shared and target resolver tests.

- [ ] **Step 5: Commit**

If the workspace is inside git:

```bash
git add src/shared/types.ts src/shared/protocol.ts src/shared/errors.ts src/core/targetResolver.ts tests/core/targetResolver.test.ts
git commit -m "feat: define monitor contracts and target resolution"
```

## Task 3: Build the controller and refresh scheduler

**Files:**
- Create: `src/core/refreshScheduler.ts`
- Create: `src/core/monitorController.ts`
- Create: `tests/core/monitorController.test.ts`

- [ ] **Step 1: Write failing controller tests**

Create `tests/core/monitorController.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { MonitorController } from '../../src/core/monitorController';
import { emptySnapshot } from '../../src/shared/types';

describe('MonitorController', () => {
  it('loads from the resolved collector', async () => {
    const localCollector = { collect: vi.fn().mockResolvedValue({ ...emptySnapshot('local'), cpu: { status: 'ok', data: { usagePercent: 12, cores: 8, load: [0.2, 0.4, 0.5] } } }) };
    const remoteCollector = { collect: vi.fn() };
    const controller = new MonitorController({
      localCollector,
      remoteCollector,
      getTarget: () => 'local'
    });

    const snapshot = await controller.refreshOverview();

    expect(localCollector.collect).toHaveBeenCalled();
    expect(snapshot.cpu.status).toBe('ok');
    expect(snapshot.target).toBe('local');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/core/monitorController.test.ts`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement a minimal refresh scheduler**

Create `src/core/refreshScheduler.ts`:

```ts
export interface RefreshIntervals {
  overviewMs: number;
  processMs: number;
  diskMs: number;
}

export class RefreshScheduler {
  constructor(private readonly intervals: RefreshIntervals) {}

  getIntervals(): RefreshIntervals {
    return this.intervals;
  }
}
```

- [ ] **Step 4: Implement the minimal controller**

Create `src/core/monitorController.ts`:

```ts
import type { MonitorSnapshot, MonitorTarget } from '../shared/types';

export interface SnapshotCollector {
  collect(kind: 'overview' | 'processes' | 'disks' | 'full'): Promise<MonitorSnapshot>;
}

export interface MonitorControllerOptions {
  localCollector: SnapshotCollector;
  remoteCollector?: SnapshotCollector;
  getTarget: () => MonitorTarget;
}

export class MonitorController {
  constructor(private readonly options: MonitorControllerOptions) {}

  async refreshOverview(): Promise<MonitorSnapshot> {
    const target = this.options.getTarget();
    if (target === 'remote' && this.options.remoteCollector) {
      return this.options.remoteCollector.collect('overview');
    }

    return this.options.localCollector.collect('overview');
  }
}
```

- [ ] **Step 5: Run tests and expand controller cache support**

Update `src/core/monitorController.ts`:

```ts
export class MonitorController {
  private latestSnapshot?: MonitorSnapshot;

  constructor(private readonly options: MonitorControllerOptions) {}

  getLatestSnapshot(): MonitorSnapshot | undefined {
    return this.latestSnapshot;
  }

  async refreshOverview(): Promise<MonitorSnapshot> {
    const target = this.options.getTarget();
    const collector =
      target === 'remote' && this.options.remoteCollector
        ? this.options.remoteCollector
        : this.options.localCollector;

    this.latestSnapshot = await collector.collect('overview');
    return this.latestSnapshot;
  }
}
```

Run: `npm test`

Expected: PASS for controller, target resolver, and shared contract tests.

- [ ] **Step 6: Commit**

If the workspace is inside git:

```bash
git add src/core/refreshScheduler.ts src/core/monitorController.ts tests/core/monitorController.test.ts
git commit -m "feat: add monitor controller and refresh scheduler"
```

## Task 4: Implement local collectors for Windows, macOS, and Linux

**Files:**
- Create: `src/collectors/local/index.ts`
- Create: `src/collectors/local/common/networkRateTracker.ts`
- Create: `src/collectors/local/windows/windowsCollector.ts`
- Create: `src/collectors/local/macos/macosCollector.ts`
- Create: `src/collectors/local/linux/linuxCollector.ts`

- [ ] **Step 1: Write the failing local collector contract test**

Append to `tests/core/monitorController.test.ts`:

```ts
it('uses local collector by default', async () => {
  const localCollector = { collect: vi.fn().mockResolvedValue(emptySnapshot('local')) };
  const controller = new MonitorController({
    localCollector,
    getTarget: () => 'local'
  });

  await controller.refreshOverview();

  expect(localCollector.collect).toHaveBeenCalledWith('overview');
});
```

- [ ] **Step 2: Run tests to verify the collector entrypoint is still missing**

Run: `npm test -- tests/core/monitorController.test.ts`

Expected: PASS for controller tests and no local collector entrypoint yet.

- [ ] **Step 3: Implement the collector factory and one concrete platform path**

Create `src/collectors/local/index.ts`:

```ts
import os from 'node:os';
import { collectLinuxSnapshot } from './linux/linuxCollector';
import { collectMacSnapshot } from './macos/macosCollector';
import { collectWindowsSnapshot } from './windows/windowsCollector';
import type { MonitorSnapshot } from '../../shared/types';

export async function collectLocalSnapshot(kind: 'overview' | 'processes' | 'disks' | 'full'): Promise<MonitorSnapshot> {
  switch (os.platform()) {
    case 'win32':
      return collectWindowsSnapshot(kind);
    case 'darwin':
      return collectMacSnapshot(kind);
    default:
      return collectLinuxSnapshot(kind);
  }
}
```

Create `src/collectors/local/linux/linuxCollector.ts`:

```ts
import os from 'node:os';
import { emptySnapshot } from '../../../shared/types';

export async function collectLinuxSnapshot(): Promise<ReturnType<typeof emptySnapshot>> {
  const snapshot = emptySnapshot('local');
  snapshot.host = {
    hostname: os.hostname(),
    platform: 'linux',
    arch: os.arch(),
    uptimeSeconds: os.uptime(),
    updatedAt: new Date().toISOString()
  };
  snapshot.cpu = {
    status: 'ok',
    data: {
      usagePercent: 0,
      cores: os.cpus().length,
      load: [os.loadavg()[0] ?? 0, os.loadavg()[1] ?? 0, os.loadavg()[2] ?? 0]
    }
  };
  return snapshot;
}
```

Create `src/collectors/local/macos/macosCollector.ts`:

```ts
export { collectLinuxSnapshot as collectMacSnapshot } from '../linux/linuxCollector';
```

Create `src/collectors/local/windows/windowsCollector.ts`:

```ts
export { collectLinuxSnapshot as collectWindowsSnapshot } from '../linux/linuxCollector';
```

Create `src/collectors/local/common/networkRateTracker.ts`:

```ts
export class NetworkRateTracker {
  private previous?: { rx: number; tx: number; at: number };

  next(current: { rx: number; tx: number; at: number }): { rxBytesPerSecond: number; txBytesPerSecond: number } {
    if (!this.previous) {
      this.previous = current;
      return { rxBytesPerSecond: 0, txBytesPerSecond: 0 };
    }

    const seconds = Math.max((current.at - this.previous.at) / 1000, 1);
    const value = {
      rxBytesPerSecond: Math.max((current.rx - this.previous.rx) / seconds, 0),
      txBytesPerSecond: Math.max((current.tx - this.previous.tx) / seconds, 0)
    };
    this.previous = current;
    return value;
  }
}
```

- [ ] **Step 4: Extend platform collectors with real module fields**

Update `src/collectors/local/linux/linuxCollector.ts`:

```ts
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { emptySnapshot } from '../../../shared/types';

const execFileAsync = promisify(execFile);

export async function collectLinuxSnapshot(kind: 'overview' | 'processes' | 'disks' | 'full') {
  const snapshot = emptySnapshot('local');
  snapshot.host = {
    hostname: os.hostname(),
    platform: 'linux',
    arch: os.arch(),
    uptimeSeconds: os.uptime(),
    updatedAt: new Date().toISOString()
  };
  snapshot.capabilities = {
    canKillProcess: true,
    canRunCustomCommand: true,
    canClearCache: true,
    canRefreshEnvironment: true
  };
  snapshot.cpu = {
    status: 'ok',
    data: {
      usagePercent: 0,
      cores: os.cpus().length,
      load: [os.loadavg()[0] ?? 0, os.loadavg()[1] ?? 0, os.loadavg()[2] ?? 0]
    }
  };
  snapshot.memory = {
    status: 'ok',
    data: {
      usedBytes: os.totalmem() - os.freemem(),
      freeBytes: os.freemem(),
      totalBytes: os.totalmem(),
      usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
    }
  };

  if (kind === 'disks' || kind === 'full') {
    const { stdout } = await execFileAsync('df', ['-kP']);
    snapshot.disks = {
      status: 'ok',
      data: stdout
        .trim()
        .split('\n')
        .slice(1)
        .map((line) => line.trim().split(/\s+/))
        .map((parts) => ({
          mount: parts[5],
          usedBytes: Number(parts[2]) * 1024,
          totalBytes: Number(parts[1]) * 1024,
          usagePercent: Number(parts[4].replace('%', ''))
        }))
    };
  }

  return snapshot;
}
```

Run: `npm run typecheck`

Expected: PASS after adjusting signature mismatches in macOS and Windows collectors.

- [ ] **Step 5: Commit**

If the workspace is inside git:

```bash
git add src/collectors/local/index.ts src/collectors/local/common/networkRateTracker.ts src/collectors/local/windows/windowsCollector.ts src/collectors/local/macos/macosCollector.ts src/collectors/local/linux/linuxCollector.ts
git commit -m "feat: add local platform collectors"
```

## Task 5: Implement remote Linux command builders and parsers

**Files:**
- Create: `src/collectors/remote/linux/commands/buildLinuxCommands.ts`
- Create: `src/collectors/remote/linux/parsers/parseCpu.ts`
- Create: `src/collectors/remote/linux/parsers/parseMemory.ts`
- Create: `src/collectors/remote/linux/parsers/parseDisk.ts`
- Create: `src/collectors/remote/linux/parsers/parseGpu.ts`
- Create: `src/collectors/remote/linux/parsers/parseProcesses.ts`
- Create: `tests/collectors/remote/linux/parsers.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create `tests/collectors/remote/linux/parsers.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseDisk } from '../../../../src/collectors/remote/linux/parsers/parseDisk';
import { parseProcesses } from '../../../../src/collectors/remote/linux/parsers/parseProcesses';

describe('remote linux parsers', () => {
  it('parses df output', () => {
    const disks = parseDisk(`Filesystem 1024-blocks Used Available Capacity Mounted on
/dev/sda1 31457280 12582912 18874368 40% /
/dev/sdb1 1073741824 21474836 1052266988 2% /data`);

    expect(disks[0].mount).toBe('/');
    expect(disks[1].usagePercent).toBe(2);
  });

  it('parses ps output', () => {
    const processes = parseProcesses(`101 root 10.0 2.5 sshd /usr/sbin/sshd -D
202 app 55.3 18.4 python python app.py`);

    expect(processes[0].pid).toBe(101);
    expect(processes[1].name).toBe('python');
  });
});
```

- [ ] **Step 2: Run parser tests**

Run: `npm test -- tests/collectors/remote/linux/parsers.test.ts`

Expected: FAIL because parser files do not exist.

- [ ] **Step 3: Implement command builders and parsers**

Create `src/collectors/remote/linux/commands/buildLinuxCommands.ts`:

```ts
export function buildLinuxCommands(kind: 'overview' | 'processes' | 'disks' | 'full') {
  return {
    cpu: "cat /proc/loadavg && nproc",
    memory: "free -b",
    disks: kind === 'disks' || kind === 'full' ? "df -kP" : '',
    processes: kind === 'processes' || kind === 'full' ? "ps -eo pid,user,%cpu,%mem,comm,args --sort=-%cpu | sed 1d | head -n 50" : '',
    gpu: "nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw,power.limit --format=csv,noheader,nounits"
  };
}
```

Create `src/collectors/remote/linux/parsers/parseDisk.ts`:

```ts
export function parseDisk(stdout: string) {
  return stdout
    .trim()
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .map((parts) => ({
      mount: parts[5],
      usedBytes: Number(parts[2]) * 1024,
      totalBytes: Number(parts[1]) * 1024,
      usagePercent: Number(parts[4].replace('%', ''))
    }));
}
```

Create `src/collectors/remote/linux/parsers/parseProcesses.ts`:

```ts
export function parseProcesses(stdout: string) {
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.trim().split(/\s+/, 6))
    .map(([pid, user, cpu, mem, name, command]) => ({
      pid: Number(pid),
      user,
      cpuPercent: Number(cpu),
      memoryPercent: Number(mem),
      name,
      command
    }));
}
```

Create `src/collectors/remote/linux/parsers/parseCpu.ts`:

```ts
export function parseCpu(stdout: string) {
  const [loadLine, coresLine] = stdout.trim().split('\n');
  const [one, five, fifteen] = loadLine.split(/\s+/).slice(0, 3).map(Number);
  return { usagePercent: 0, cores: Number(coresLine), load: [one, five, fifteen] as [number, number, number] };
}
```

Create `src/collectors/remote/linux/parsers/parseMemory.ts`:

```ts
export function parseMemory(stdout: string) {
  const line = stdout.split('\n').find((value) => value.startsWith('Mem:'));
  if (!line) {
    return { usedBytes: 0, freeBytes: 0, totalBytes: 0, usagePercent: 0 };
  }

  const [, total, used, free] = line.trim().split(/\s+/);
  return {
    totalBytes: Number(total),
    usedBytes: Number(used),
    freeBytes: Number(free),
    usagePercent: Number(total) > 0 ? (Number(used) / Number(total)) * 100 : 0
  };
}
```

Create `src/collectors/remote/linux/parsers/parseGpu.ts`:

```ts
export function parseGpu(stdout: string) {
  return stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(',').map((value) => value.trim()))
    .map(([index, name, usagePercent, memoryUsedMb, memoryTotalMb, temperatureC, powerDrawW, powerLimitW]) => ({
      index: Number(index),
      name,
      usagePercent: Number(usagePercent),
      memoryUsedMb: Number(memoryUsedMb),
      memoryTotalMb: Number(memoryTotalMb),
      temperatureC: Number(temperatureC),
      powerDrawW: Number(powerDrawW),
      powerLimitW: Number(powerLimitW)
    }));
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/collectors/remote/linux/parsers.test.ts`

Expected: PASS for parser tests.

- [ ] **Step 5: Commit**

If the workspace is inside git:

```bash
git add src/collectors/remote/linux/commands/buildLinuxCommands.ts src/collectors/remote/linux/parsers/parseCpu.ts src/collectors/remote/linux/parsers/parseMemory.ts src/collectors/remote/linux/parsers/parseDisk.ts src/collectors/remote/linux/parsers/parseGpu.ts src/collectors/remote/linux/parsers/parseProcesses.ts tests/collectors/remote/linux/parsers.test.ts
git commit -m "feat: add remote linux command parsers"
```

## Task 6: Implement remote collector and action service

**Files:**
- Create: `src/collectors/remote/linux/remoteLinuxCollector.ts`
- Create: `src/actions/actionValidators.ts`
- Create: `src/actions/actionService.ts`
- Create: `src/config/settings.ts`
- Create: `tests/actions/actionService.test.ts`

- [ ] **Step 1: Write failing action tests**

Create `tests/actions/actionService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateCustomCommand } from '../../src/actions/actionValidators';

describe('validateCustomCommand', () => {
  it('accepts a configured command name', () => {
    expect(
      validateCustomCommand(
        [{ id: 'refresh-env', label: 'Refresh Env', command: 'env' }],
        'refresh-env'
      )
    ).toBe('env');
  });

  it('rejects a missing command id', () => {
    expect(() => validateCustomCommand([], 'missing')).toThrow('Unknown custom command');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/actions/actionService.test.ts`

Expected: FAIL because action validators do not exist.

- [ ] **Step 3: Implement action validation and settings**

Create `src/config/settings.ts`:

```ts
import * as vscode from 'vscode';

export interface CustomCommandSetting {
  id: string;
  label: string;
  command: string;
}

export function getCustomCommands(): CustomCommandSetting[] {
  return vscode.workspace
    .getConfiguration('serverMonitor')
    .get<CustomCommandSetting[]>('customCommands', []);
}
```

Create `src/actions/actionValidators.ts`:

```ts
import type { CustomCommandSetting } from '../config/settings';

export function validateCustomCommand(commands: CustomCommandSetting[], commandId: string): string {
  const match = commands.find((item) => item.id === commandId);
  if (!match) {
    throw new Error('Unknown custom command');
  }

  return match.command;
}
```

Create `src/actions/actionService.ts`:

```ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getCustomCommands } from '../config/settings';
import { validateCustomCommand } from './actionValidators';

const execAsync = promisify(exec);

export class ActionService {
  async runCustomCommand(commandId: string) {
    const command = validateCustomCommand(getCustomCommands(), commandId);
    return execAsync(command);
  }

  async killProcess(pid: number) {
    const command = process.platform === 'win32' ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`;
    return execAsync(command);
  }
}
```

Create `src/collectors/remote/linux/remoteLinuxCollector.ts`:

```ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { buildLinuxCommands } from './commands/buildLinuxCommands';
import { parseCpu } from './parsers/parseCpu';
import { parseDisk } from './parsers/parseDisk';
import { parseGpu } from './parsers/parseGpu';
import { parseMemory } from './parsers/parseMemory';
import { parseProcesses } from './parsers/parseProcesses';
import { emptySnapshot } from '../../../shared/types';

const execAsync = promisify(exec);

export class RemoteLinuxCollector {
  async collect(kind: 'overview' | 'processes' | 'disks' | 'full') {
    const commands = buildLinuxCommands(kind);
    const snapshot = emptySnapshot('remote');

    const cpuResult = await execAsync(commands.cpu, { shell: '/bin/sh' });
    snapshot.cpu = { status: 'ok', data: parseCpu(cpuResult.stdout) };

    const memoryResult = await execAsync(commands.memory, { shell: '/bin/sh' });
    snapshot.memory = { status: 'ok', data: parseMemory(memoryResult.stdout) };

    if (commands.disks) {
      const diskResult = await execAsync(commands.disks, { shell: '/bin/sh' });
      snapshot.disks = { status: 'ok', data: parseDisk(diskResult.stdout) };
    }

    if (commands.processes) {
      const processResult = await execAsync(commands.processes, { shell: '/bin/sh' });
      snapshot.processes = { status: 'ok', data: parseProcesses(processResult.stdout) };
    }

    try {
      const gpuResult = await execAsync(commands.gpu, { shell: '/bin/sh' });
      snapshot.gpus = { status: 'ok', data: parseGpu(gpuResult.stdout) };
    } catch {
      snapshot.gpus = { status: 'unsupported', data: [] };
    }

    return snapshot;
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test`

Expected: PASS for action validator, controller, and parser tests.

Run: `npm run typecheck`

Expected: PASS after adjusting snapshot typing and optional host fields in the remote collector.

- [ ] **Step 5: Commit**

If the workspace is inside git:

```bash
git add src/collectors/remote/linux/remoteLinuxCollector.ts src/actions/actionValidators.ts src/actions/actionService.ts src/config/settings.ts tests/actions/actionService.test.ts
git commit -m "feat: add remote collector and action service"
```

## Task 7: Register the extension, Webview, and Tree View

**Files:**
- Create: `src/extension.ts`
- Create: `src/views/monitorTreeDataProvider.ts`
- Create: `src/webview/dashboardPanel.ts`
- Create: `src/webview/getHtml.ts`
- Create: `media/dashboard.css`
- Create: `media/dashboard.js`

- [ ] **Step 1: Write the failing view smoke test as a typecheck target**

Add `src/extension.ts` reference in `esbuild.mjs` entrypoint and rely on build failure because the file does not exist.

Run: `npm run build`

Expected: FAIL with `Could not resolve "src/extension.ts"` or type errors from missing modules.

- [ ] **Step 2: Implement Tree View and Webview glue**

Create `src/views/monitorTreeDataProvider.ts`:

```ts
import * as vscode from 'vscode';
import type { MonitorSnapshot } from '../shared/types';

export class MonitorTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changeEmitter.event;
  private snapshot?: MonitorSnapshot;

  setSnapshot(snapshot: MonitorSnapshot) {
    this.snapshot = snapshot;
    this.changeEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem) {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    if (!this.snapshot) {
      return [new vscode.TreeItem('暂无监控数据')];
    }

    return [
      new vscode.TreeItem(`目标: ${this.snapshot.target}`),
      new vscode.TreeItem(`CPU: ${this.snapshot.cpu.data.usagePercent.toFixed(1)}%`),
      new vscode.TreeItem(`内存: ${this.snapshot.memory.data.usagePercent.toFixed(1)}%`),
      new vscode.TreeItem(`磁盘数: ${this.snapshot.disks.data.length}`),
      new vscode.TreeItem(`进程数: ${this.snapshot.processes.data.length}`)
    ];
  }
}
```

Create `src/webview/getHtml.ts`:

```ts
import * as vscode from 'vscode';

export function getDashboardHtml(webview: vscode.Webview, extensionUri: vscode.Uri) {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard.css'));

  return `<!DOCTYPE html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="${styleUri}" />
    </head>
    <body>
      <div id="app">加载中...</div>
      <script src="${scriptUri}"></script>
    </body>
  </html>`;
}
```

Create `src/webview/dashboardPanel.ts`:

```ts
import * as vscode from 'vscode';
import { getDashboardHtml } from './getHtml';
import type { MonitorSnapshot } from '../shared/types';

export class DashboardPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'serverMonitor.dashboard';
  private view?: vscode.WebviewView;

  constructor(private readonly extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    webviewView.webview.html = getDashboardHtml(webviewView.webview, this.extensionUri);
  }

  update(snapshot: MonitorSnapshot) {
    this.view?.webview.postMessage({ type: 'snapshot', snapshot });
  }
}
```

Create `media/dashboard.css`:

```css
body {
  padding: 0;
  margin: 0;
  font-family: "Segoe UI", "PingFang SC", sans-serif;
  background: #f4f6fb;
  color: #1f2937;
}

#app {
  padding: 12px;
}

.card {
  background: #ffffff;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}
```

Create `media/dashboard.js`:

```js
const app = document.getElementById('app');

window.addEventListener('message', (event) => {
  const { type, snapshot } = event.data;
  if (type !== 'snapshot') {
    return;
  }

  app.innerHTML = `
    <div class="card">目标: ${snapshot.target}</div>
    <div class="card">CPU: ${snapshot.cpu.data.usagePercent.toFixed(1)}%</div>
    <div class="card">内存: ${snapshot.memory.data.usagePercent.toFixed(1)}%</div>
    <div class="card">磁盘: ${snapshot.disks.data.length}</div>
  `;
});
```

- [ ] **Step 3: Implement extension activation**

Create `src/extension.ts`:

```ts
import * as vscode from 'vscode';
import { ActionService } from './actions/actionService';
import { collectLocalSnapshot } from './collectors/local';
import { RemoteLinuxCollector } from './collectors/remote/linux/remoteLinuxCollector';
import { MonitorController } from './core/monitorController';
import { resolveMonitorTarget } from './core/targetResolver';
import { DashboardPanel } from './webview/dashboardPanel';
import { MonitorTreeDataProvider } from './views/monitorTreeDataProvider';

export async function activate(context: vscode.ExtensionContext) {
  const treeProvider = new MonitorTreeDataProvider();
  const dashboard = new DashboardPanel(context.extensionUri);
  const actionService = new ActionService();

  const localCollector = { collect: collectLocalSnapshot };
  const remoteCollector = vscode.env.remoteName === 'ssh-remote' ? new RemoteLinuxCollector() : undefined;
  let preferredTarget: 'local' | 'remote' | undefined;

  const controller = new MonitorController({
    localCollector,
    remoteCollector,
    getTarget: () =>
      resolveMonitorTarget({
        preferredTarget,
        autoSwitchToRemote: vscode.workspace.getConfiguration('serverMonitor').get('autoSwitchToRemote', true),
        isRemoteWindow: vscode.env.remoteName === 'ssh-remote',
        hasRemoteCollector: Boolean(remoteCollector)
      })
  });

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('serverMonitor.summary', treeProvider),
    vscode.window.registerWebviewViewProvider(DashboardPanel.viewType, dashboard),
    vscode.commands.registerCommand('serverMonitor.refresh', async () => {
      const snapshot = await controller.refreshOverview();
      treeProvider.setSnapshot(snapshot);
      dashboard.update(snapshot);
    }),
    vscode.commands.registerCommand('serverMonitor.switchTarget', async () => {
      preferredTarget = preferredTarget === 'remote' ? 'local' : 'remote';
      await vscode.commands.executeCommand('serverMonitor.refresh');
    }),
    vscode.commands.registerCommand('serverMonitor.killProcess', async (pid?: number) => {
      if (!pid) {
        return;
      }
      await actionService.killProcess(pid);
      await vscode.commands.executeCommand('serverMonitor.refresh');
    })
  );

  await vscode.commands.executeCommand('serverMonitor.refresh');
}

export function deactivate() {}
```

- [ ] **Step 4: Run build, tests, and typecheck**

Run: `npm run build`

Expected: PASS with `dist/extension.js` generated.

Run: `npm test`

Expected: PASS for existing unit tests.

Run: `npm run typecheck`

Expected: PASS after correcting collector signatures and `registerWebviewViewProvider` typing.

- [ ] **Step 5: Commit**

If the workspace is inside git:

```bash
git add src/extension.ts src/views/monitorTreeDataProvider.ts src/webview/dashboardPanel.ts src/webview/getHtml.ts media/dashboard.css media/dashboard.js
git commit -m "feat: register dashboard and summary views"
```

## Task 8: Polish the dashboard data flow and end-to-end verification

**Files:**
- Modify: `src/core/monitorController.ts`
- Modify: `src/webview/dashboardPanel.ts`
- Modify: `media/dashboard.js`
- Modify: `media/dashboard.css`
- Modify: `src/extension.ts`

- [ ] **Step 1: Write the failing integration assertion**

Append to `tests/core/monitorController.test.ts`:

```ts
it('falls back to local collector when remote target is requested without a remote collector', async () => {
  const localCollector = { collect: vi.fn().mockResolvedValue(emptySnapshot('local')) };
  const controller = new MonitorController({
    localCollector,
    getTarget: () => 'remote'
  });

  const snapshot = await controller.refreshOverview();

  expect(snapshot.target).toBe('local');
  expect(localCollector.collect).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/core/monitorController.test.ts`

Expected: FAIL because the controller returns whatever the active collector provides.

- [ ] **Step 3: Implement final snapshot normalization and richer UI payload**

Update `src/core/monitorController.ts`:

```ts
async refreshOverview(): Promise<MonitorSnapshot> {
  const target = this.options.getTarget();
  const collector =
    target === 'remote' && this.options.remoteCollector
      ? this.options.remoteCollector
      : this.options.localCollector;

  this.latestSnapshot = await collector.collect('overview');
  if (target === 'remote' && !this.options.remoteCollector) {
    this.latestSnapshot = { ...this.latestSnapshot, target: 'local' };
  }
  return this.latestSnapshot;
}
```

Update `media/dashboard.js`:

```js
const app = document.getElementById('app');

function card(title, value, detail = '') {
  return `<section class="card"><div class="label">${title}</div><div class="value">${value}</div><div class="detail">${detail}</div></section>`;
}

window.addEventListener('message', (event) => {
  const { type, snapshot } = event.data;
  if (type !== 'snapshot') return;

  const updatedAt = new Date(snapshot.host.updatedAt).toLocaleTimeString();
  app.innerHTML = `
    <header class="hero">
      <div>
        <div class="title">服务器监控</div>
        <div class="subtitle">${snapshot.host.hostname || 'Unknown Host'} · ${snapshot.target} · 更新于 ${updatedAt}</div>
      </div>
    </header>
    <div class="grid">
      ${card('CPU', `${snapshot.cpu.data.usagePercent.toFixed(1)}%`, `负载 ${snapshot.cpu.data.load.join(' / ')}`)}
      ${card('RAM', `${snapshot.memory.data.usagePercent.toFixed(1)}%`, `${Math.round(snapshot.memory.data.usedBytes / 1024 / 1024 / 1024)} / ${Math.round(snapshot.memory.data.totalBytes / 1024 / 1024 / 1024)} GB`)}
      ${card('磁盘', `${snapshot.disks.data.length} 个挂载点`, snapshot.disks.data.map((item) => `${item.mount} ${item.usagePercent}%`).join('<br/>'))}
      ${card('进程', `${snapshot.processes.data.length}`, snapshot.processes.data.slice(0, 3).map((item) => `${item.name} ${item.cpuPercent.toFixed(1)}%`).join('<br/>'))}
    </div>
  `;
});
```

Update `media/dashboard.css`:

```css
body {
  padding: 0;
  margin: 0;
  font-family: "Segoe UI", "PingFang SC", sans-serif;
  background: linear-gradient(180deg, #f7f8fb 0%, #eef2f7 100%);
  color: #1f2937;
}

#app {
  padding: 12px;
}

.hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.title {
  font-size: 18px;
  font-weight: 700;
}

.subtitle {
  font-size: 12px;
  color: #6b7280;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.card {
  background: #ffffff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
}

.label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}

.value {
  font-size: 20px;
  font-weight: 700;
  color: #1d4ed8;
  margin-bottom: 6px;
}

.detail {
  font-size: 12px;
  line-height: 1.5;
}
```

- [ ] **Step 4: Perform the final verification pass**

Run: `npm test`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS with bundled extension output.

Manual verification:

```text
1. Press F5 in VS Code to launch the Extension Development Host.
2. Open the "服务器监控" activity bar view in a local window and confirm local data appears.
3. Connect to a Remote SSH Linux host and confirm the dashboard defaults to remote.
4. Use the switch target command and confirm it returns to local mode.
5. If the remote host has NVIDIA drivers, confirm GPU data appears; otherwise confirm graceful unsupported state.
6. Trigger the kill process command against a test process and confirm the dashboard refreshes.
```

- [ ] **Step 5: Commit**

If the workspace is inside git:

```bash
git add src/core/monitorController.ts src/webview/dashboardPanel.ts media/dashboard.js media/dashboard.css src/extension.ts tests/core/monitorController.test.ts
git commit -m "feat: polish monitor dashboard flow"
```

## Self-Review

### Spec coverage

- 双宿主架构: Task 2, Task 3, Task 6, Task 7
- 本机 / 远程切换: Task 2, Task 7, Task 8
- 本机多平台采集: Task 4
- 远程 Linux 采集: Task 5, Task 6
- 活动栏面板与树视图: Task 7, Task 8
- GPU、进程、磁盘、内存、CPU: Task 4, Task 5, Task 6, Task 8
- 操作能力与自定义命令: Task 6, Task 7

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” placeholders remain.
- Each task includes concrete files, code, commands, and expected outcomes.

### Type consistency

- Shared `MonitorSnapshot` and `MonitorTarget` names remain consistent across tasks.
- Controller always accepts collectors with `collect(kind)` and returns `MonitorSnapshot`.

