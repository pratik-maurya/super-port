import * as vscode from 'vscode';
import { PortInfo } from '../core/types';

export class SuperPortTreeItem extends vscode.TreeItem {
  constructor(
    public readonly portInfo: PortInfo,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
  ) {
    super(`:${portInfo.port} — ${portInfo.framework.name}`, collapsibleState);

    this.id = `port-${portInfo.port}-${portInfo.pid}`;
    this.description = `[PID ${portInfo.pid}] • ${portInfo.memoryFormatted} • ${portInfo.processName}`;
    this.contextValue = 'portItem';

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${portInfo.framework.icon} ${portInfo.framework.name} (: ${portInfo.port})\n\n`);
    md.appendMarkdown(`- **URL**: [${portInfo.url}](${portInfo.url})\n`);
    md.appendMarkdown(`- **PID**: \`${portInfo.pid}\` (${portInfo.processName})\n`);
    md.appendMarkdown(`- **Memory**: \`${portInfo.memoryFormatted}\`\n`);
    md.appendMarkdown(`- **Local Address**: \`${portInfo.localAddress}\`\n`);
    md.appendMarkdown(`- **Active Connections**: \`${portInfo.activeConnectionsCount}\`\n`);
    if (portInfo.commandLine) {
      md.appendMarkdown(`- **Command**: \`${portInfo.commandLine.substring(0, 150)}${portInfo.commandLine.length > 150 ? '...' : ''}\`\n`);
    }
    this.tooltip = md;

    // Use built-in ThemeIcons based on framework category
    if (portInfo.framework.category === 'dev-server') {
      this.iconPath = new vscode.ThemeIcon('zap', new vscode.ThemeColor('charts.purple'));
    } else if (portInfo.framework.category === 'api-runtime') {
      this.iconPath = new vscode.ThemeIcon('server-process', new vscode.ThemeColor('charts.green'));
    } else if (portInfo.framework.category === 'database') {
      this.iconPath = new vscode.ThemeIcon('database', new vscode.ThemeColor('charts.blue'));
    } else if (portInfo.framework.category === 'docker') {
      this.iconPath = new vscode.ThemeIcon('package', new vscode.ThemeColor('charts.blue'));
    } else {
      this.iconPath = new vscode.ThemeIcon('radio-tower');
    }
  }
}

export class SuperPortCategoryItem extends vscode.TreeItem {
  constructor(
    public readonly title: string,
    public readonly items: PortInfo[],
    iconName: string,
    colorId: string
  ) {
    super(`${title} (${items.length})`, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(iconName, new vscode.ThemeColor(colorId));
    this.contextValue = 'categoryItem';
  }
}

export class SuperPortTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

  private ports: PortInfo[] = [];

  public setPorts(ports: PortInfo[]): void {
    this.ports = ports;
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  public async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      if (this.ports.length === 0) {
        const emptyItem = new vscode.TreeItem('No active dev servers detected');
        emptyItem.description = 'Click refresh to scan';
        emptyItem.iconPath = new vscode.ThemeIcon('info');
        return [emptyItem];
      }

      const devServers = this.ports.filter(p => p.framework.category === 'dev-server' || p.framework.category === 'api-runtime');
      const databases = this.ports.filter(p => p.framework.category === 'database' || p.framework.category === 'docker');
      const others = this.ports.filter(p => p.framework.category !== 'dev-server' && p.framework.category !== 'api-runtime' && p.framework.category !== 'database' && p.framework.category !== 'docker');

      const categories: vscode.TreeItem[] = [];

      if (devServers.length > 0) {
        categories.push(new SuperPortCategoryItem('Dev Servers & APIs', devServers, 'zap', 'charts.purple'));
      }
      if (databases.length > 0) {
        categories.push(new SuperPortCategoryItem('Databases & Containers', databases, 'database', 'charts.blue'));
      }
      if (others.length > 0) {
        categories.push(new SuperPortCategoryItem('Other Listening Ports', others, 'radio-tower', 'charts.yellow'));
      }

      return categories;
    }

    if (element instanceof SuperPortCategoryItem) {
      return element.items.map(p => new SuperPortTreeItem(p));
    }

    return [];
  }
}
