import * as crypto from 'node:crypto';

import * as vscode from 'vscode';

import type { MonitorSnapshot } from '../shared/types.ts';
import { getDashboardHtml } from './getHtml.ts';

interface DashboardMessage {
  type: 'refresh' | 'killProcess' | 'ready';
  pid?: unknown;
}

export interface DashboardPanelOptions {
  extensionUri: vscode.Uri;
  onRefresh: () => Promise<void>;
  onKillProcess: (pid: number) => Promise<void>;
}

export class DashboardPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private snapshot?: MonitorSnapshot;

  constructor(private readonly options: DashboardPanelOptions) {}

  updateSnapshot(snapshot: MonitorSnapshot | undefined): void {
    this.snapshot = snapshot;
    void this.postSnapshot();
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.options.extensionUri, 'media')]
    };
    view.webview.html = getDashboardHtml({
      cspSource: view.webview.cspSource,
      cssUri: view.webview.asWebviewUri(vscode.Uri.joinPath(this.options.extensionUri, 'media', 'dashboard.css')).toString(),
      jsUri: view.webview.asWebviewUri(vscode.Uri.joinPath(this.options.extensionUri, 'media', 'dashboard.js')).toString(),
      nonce: crypto.randomBytes(16).toString('hex'),
      initialState: {
        snapshot: this.snapshot
          ? {
              target: this.snapshot.target,
              host: this.snapshot.host
            }
          : undefined
      }
    });
    view.webview.onDidReceiveMessage((message: DashboardMessage) => {
      void this.handleMessage(message);
    });
    void this.postSnapshot();
  }

  private async handleMessage(message: DashboardMessage): Promise<void> {
    if (message.type === 'refresh') {
      await this.options.onRefresh();
      return;
    }

    if (message.type === 'killProcess') {
      const pid = typeof message.pid === 'number' ? message.pid : Number(message.pid);
      if (!Number.isInteger(pid) || pid <= 0) {
        void vscode.window.showErrorMessage('Invalid process id.');
        return;
      }

      await this.options.onKillProcess(pid);
      return;
    }

    if (message.type === 'ready') {
      await this.postSnapshot();
    }
  }

  private async postSnapshot(): Promise<void> {
    if (!this.view) {
      return;
    }

    await this.view.webview.postMessage({
      type: 'snapshot',
      snapshot: this.snapshot
    });
  }
}
