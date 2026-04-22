import * as vscode from 'vscode';

import { ActionService } from './actions/actionService.ts';
import { createLocalCollector } from './collectors/local/index.ts';
import { RemoteLinuxCollector } from './collectors/remote/linux/remoteLinuxCollector.ts';
import { MonitorController } from './core/monitorController.ts';
import { resolveMonitorTarget } from './core/targetResolver.ts';
import { MonitorTreeDataProvider } from './views/monitorTreeDataProvider.ts';
import { DashboardPanel } from './webview/dashboardPanel.ts';

export function activate(context: vscode.ExtensionContext): void {
  const localCollector = createLocalCollector();
  const remoteCollector = createRemoteCollector();
  const controller = new MonitorController({
    localCollector,
    remoteCollector,
    getTarget: () =>
      resolveMonitorTarget({
        isRemoteWindow: Boolean(vscode.env.remoteName),
        hasRemoteCollector: Boolean(remoteCollector)
      })
  });
  const actionService = new ActionService();
  const treeDataProvider = new MonitorTreeDataProvider();
  const dashboardPanel = new DashboardPanel({
    extensionUri: context.extensionUri,
    onRefresh: async () => {
      await refreshOverview();
    },
    onKillProcess: async (pid: number) => {
      await killProcess(pid);
    }
  });

  async function refreshOverview(): Promise<void> {
    try {
      const snapshot = await controller.refreshOverview();
      treeDataProvider.updateSnapshot(snapshot);
      dashboardPanel.updateSnapshot(snapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh monitor overview.';
      void vscode.window.showErrorMessage(message);
    }
  }

  async function killProcess(pid: number): Promise<void> {
    try {
      await actionService.killProcess(pid);
      await refreshOverview();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to kill process ${pid}.`;
      void vscode.window.showErrorMessage(message);
    }
  }

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('serverMonitor.summary', treeDataProvider),
    vscode.window.registerWebviewViewProvider('serverMonitor.dashboard', dashboardPanel),
    vscode.commands.registerCommand('serverMonitor.refreshOverview', async () => {
      await refreshOverview();
    }),
    vscode.commands.registerCommand('serverMonitor.killProcess', async (pid: unknown) => {
      const numericPid = typeof pid === 'number' ? pid : Number(pid);
      if (!Number.isInteger(numericPid) || numericPid <= 0) {
        void vscode.window.showErrorMessage('A valid process id is required.');
        return;
      }

      await killProcess(numericPid);
    })
  );

  void refreshOverview();
}

export function deactivate(): void {}

function createRemoteCollector(): RemoteLinuxCollector | undefined {
  if (!vscode.env.remoteName) {
    return undefined;
  }

  if (process.platform !== 'linux') {
    return undefined;
  }

  return new RemoteLinuxCollector();
}
