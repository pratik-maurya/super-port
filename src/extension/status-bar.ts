import * as vscode from 'vscode';
import { PortInfo } from '../core/types';

export class SuperPortStatusBar {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'super-port.quickKill';
    this.update([]);
  }

  public update(ports: PortInfo[]): void {
    const devPorts = ports.filter(p => p.isDevServer);
    const count = devPorts.length;

    if (count === 0) {
      this.statusBarItem.text = `$(zap) Super Port`;
      this.statusBarItem.tooltip = new vscode.MarkdownString(
        '**⚡ Super Port**: No dev servers active.\n\nClick to inspect all listening ports or launch dashboard.'
      );
    } else if (count === 1) {
      const p = devPorts[0];
      this.statusBarItem.text = `$(zap) :${p.port} (${p.framework.name.split(' ')[0]})`;
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`### ⚡ Super Port: 1 Active Dev Server\n\n`);
      md.appendMarkdown(`- **Port**: :${p.port}\n`);
      md.appendMarkdown(`- **Server**: ${p.framework.name}\n`);
      md.appendMarkdown(`- **PID**: ${p.pid} (${p.processName})\n`);
      md.appendMarkdown(`- **RAM**: ${p.memoryFormatted}\n`);
      md.appendMarkdown(`- **URL**: [${p.url}](${p.url})\n\n`);
      md.appendMarkdown(`*Click to quick-kill or manage ports.*`);
      this.statusBarItem.tooltip = md;
    } else {
      this.statusBarItem.text = `$(zap) ${count} Dev Ports`;
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`### ⚡ Super Port: ${count} Active Dev Servers\n\n`);
      for (const p of devPorts) {
        md.appendMarkdown(`- **:${p.port}** ${p.framework.icon} ${p.framework.name} (PID ${p.pid}, ${p.memoryFormatted})\n`);
      }
      md.appendMarkdown(`\n*Click to quick-kill or manage ports.*`);
      this.statusBarItem.tooltip = md;
    }

    this.statusBarItem.show();
  }

  public dispose(): void {
    this.statusBarItem.dispose();
  }
}
