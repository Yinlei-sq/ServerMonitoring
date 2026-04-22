import * as vscode from 'vscode';

import type { MonitorSnapshot } from '../shared/types.ts';
import { buildSummaryRows } from './summaryTreeModel.ts';

export class MonitorTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<void>();
  private snapshot?: MonitorSnapshot;

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  updateSnapshot(snapshot: MonitorSnapshot | undefined): void {
    this.snapshot = snapshot;
    this.refresh();
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    return buildSummaryRows(this.snapshot).map((row) => {
      const item = new vscode.TreeItem(row.label, vscode.TreeItemCollapsibleState.None);
      item.id = row.id;
      item.description = row.description;
      item.tooltip = row.tooltip ?? [row.label, row.description].filter(Boolean).join(': ');
      item.contextValue = row.contextValue;

      if (row.action?.type === 'killProcess') {
        item.command = {
          command: 'serverMonitor.killProcess',
          title: 'Kill Process',
          arguments: [row.action.pid]
        };
      }

      return item;
    });
  }
}
