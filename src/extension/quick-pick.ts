import * as vscode from 'vscode';
import { PortInfo } from '../core/types';
import { ProcessKiller } from '../core/process-killer';
import { ServerRestarter } from '../core/server-restarter';
import { TrafficInspector } from '../core/traffic-inspector';

interface PortQuickPickItem extends vscode.QuickPickItem {
  portInfo?: PortInfo;
  isKillAllAction?: boolean;
}

export class SuperPortQuickPick {
  public static async showQuickKillMenu(
    ports: PortInfo[],
    killer: ProcessKiller,
    restarter: ServerRestarter,
    trafficInspector: TrafficInspector,
    onRefreshNeeded: () => Promise<void>
  ): Promise<void> {
    const devPorts = ports.filter(p => p.isDevServer);

    const items: PortQuickPickItem[] = [];

    if (devPorts.length > 1) {
      items.push({
        label: `$(clear-all) 💥 Kill ALL Active Dev Ports (${devPorts.length} running)`,
        description: `Terminate all Vite, Next.js, Angular, Python dev servers`,
        isKillAllAction: true
      });
    }

    for (const p of ports) {
      const isDev = p.isDevServer;
      items.push({
        label: `${p.framework.icon} :${p.port} — ${p.framework.name}`,
        description: `PID ${p.pid} (${p.processName}) • ${p.memoryFormatted} RAM • ${p.activeConnectionsCount} conns`,
        detail: p.commandLine ? `Command: ${p.commandLine.substring(0, 100)}...` : `Local: ${p.localAddress}`,
        portInfo: p
      });
    }

    if (items.length === 0) {
      vscode.window.showInformationMessage('Super Port: No active listening ports found.');
      return;
    }

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: '⚡ Super Port: Select a port to kill, restart, inspect, or copy URL',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!selected) return;

    if (selected.isKillAllAction) {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to terminate all ${devPorts.length} dev server processes?`,
        { modal: true },
        'Kill All'
      );
      if (confirm === 'Kill All') {
        const results = await killer.killAllDevPorts(devPorts);
        const successCount = results.filter(r => r.success).length;
        vscode.window.showInformationMessage(`⚡ Super Port: Terminated ${successCount} dev server process trees.`);
        await onRefreshNeeded();
      }
      return;
    }

    const p = selected.portInfo;
    if (!p) return;

    // Action sub-menu for the selected port
    const actionItems = [
      {
        action: 'kill',
        label: `$(zap) 1-Click Kill Port :${p.port}`,
        description: `Force kill PID ${p.pid} (${p.processName}) and all child processes`
      },
      {
        action: 'restart',
        label: `$(debug-restart) Restart Server on :${p.port}`,
        description: `Kill existing PID ${p.pid} and prepare restart`
      },
      {
        action: 'inspect',
        label: `$(radio-tower) Inspect Traffic & Connections`,
        description: `View active clients and TCP states for port :${p.port}`
      },
      {
        action: 'browser',
        label: `$(globe) Open in Browser`,
        description: p.url
      },
      {
        action: 'copy',
        label: `$(copy) Copy URL to Clipboard`,
        description: p.url
      }
    ];

    const action = await vscode.window.showQuickPick(actionItems, {
      placeHolder: `Action for :${p.port} (${p.framework.name})`
    });

    if (!action) return;

    switch (action.action) {
      case 'kill': {
        const result = await killer.killProcessTree(p.pid, p.processName, p.port);
        if (result.success) {
          vscode.window.showInformationMessage(`⚡ Super Port: Killed port :${p.port} (PID ${p.pid})!`);
          await onRefreshNeeded();
        } else {
          vscode.window.showErrorMessage(`Failed to kill port :${p.port}: ${result.message}`);
        }
        break;
      }
      case 'restart': {
        const restartRes = await restarter.prepareRestart(p.port);
        if (restartRes.success) {
          vscode.window.showInformationMessage(`🔄 Super Port: Port :${p.port} freed for restart!`);
          await onRefreshNeeded();
        } else {
          vscode.window.showErrorMessage(`Failed to restart port :${p.port}: ${restartRes.message}`);
        }
        break;
      }
      case 'inspect': {
        const traffic = await trafficInspector.inspectPortTraffic(p.port);
        const msg = `Port :${p.port} (${p.framework.name}) Traffic: ${traffic.totalConnections} total conns (${traffic.establishedCount} established, ${traffic.timeWaitCount} time-wait). Remote IPs: ${traffic.uniqueRemoteIps.join(', ') || 'None'}`;
        vscode.window.showInformationMessage(msg);
        break;
      }
      case 'browser': {
        vscode.env.openExternal(vscode.Uri.parse(p.url));
        break;
      }
      case 'copy': {
        await vscode.env.clipboard.writeText(p.url);
        vscode.window.showInformationMessage(`Copied ${p.url} to clipboard.`);
        break;
      }
    }
  }
}
