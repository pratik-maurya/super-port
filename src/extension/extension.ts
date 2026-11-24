import * as vscode from 'vscode';
import { PortScanner } from '../core/port-scanner';
import { ProcessKiller } from '../core/process-killer';
import { TrafficInspector } from '../core/traffic-inspector';
import { ServerRestarter } from '../core/server-restarter';
import { SuperPortStatusBar } from './status-bar';
import { SuperPortTreeDataProvider, SuperPortTreeItem } from './tree-provider';
import { SuperPortQuickPick } from './quick-pick';
import { SuperPortWebviewDashboard } from './webview-dashboard';
import { TerminalMonitor } from './terminal-monitor';

let autoRefreshTimer: NodeJS.Timeout | null = null;

export async function activate(context: vscode.ExtensionContext) {
  const scanner = new PortScanner();
  const killer = new ProcessKiller(scanner);
  const trafficInspector = new TrafficInspector(scanner);
  const restarter = new ServerRestarter(killer, scanner);

  // Status Bar
  const statusBar = new SuperPortStatusBar();
  context.subscriptions.push(statusBar);

  // Tree View
  const treeDataProvider = new SuperPortTreeDataProvider();
  const treeView = vscode.window.createTreeView('superPortExplorer', {
    treeDataProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);

  // Terminal Collision Monitor
  const terminalMonitor = new TerminalMonitor(killer, scanner);
  context.subscriptions.push(terminalMonitor);

  // Function to refresh state across views
  const refreshAll = async () => {
    try {
      const config = vscode.workspace.getConfiguration('superPort');
      const showSystemPorts = config.get<boolean>('showSystemPorts', false);
      const ports = await scanner.scanListeningPorts({ includeSystemPorts: showSystemPorts });

      statusBar.update(ports);
      treeDataProvider.setPorts(ports);

      if (SuperPortWebviewDashboard.currentPanel) {
        SuperPortWebviewDashboard.currentPanel.refreshData();
      }
    } catch (err: any) {
      console.error('Super Port refresh error:', err);
    }
  };

  // Commands Registration
  context.subscriptions.push(
    vscode.commands.registerCommand('super-port.refresh', async () => {
      await refreshAll();
      vscode.window.setStatusBarMessage('⚡ Super Port: Refreshed active ports', 2000);
    }),

    vscode.commands.registerCommand('super-port.showDashboard', () => {
      SuperPortWebviewDashboard.createOrShow(
        context.extensionUri,
        scanner,
        killer,
        trafficInspector,
        restarter
      );
    }),

    vscode.commands.registerCommand('super-port.quickKill', async () => {
      const config = vscode.workspace.getConfiguration('superPort');
      const showSystemPorts = config.get<boolean>('showSystemPorts', false);
      const ports = await scanner.scanListeningPorts({ includeSystemPorts: showSystemPorts });
      await SuperPortQuickPick.showQuickKillMenu(
        ports,
        killer,
        restarter,
        trafficInspector,
        refreshAll
      );
    }),

    vscode.commands.registerCommand('super-port.killPort', async (item?: SuperPortTreeItem | number) => {
      let targetPort: number | undefined;
      let targetPid: number | undefined;
      let procName: string | undefined;

      if (typeof item === 'number') {
        targetPort = item;
      } else if (item && item.portInfo) {
        targetPort = item.portInfo.port;
        targetPid = item.portInfo.pid;
        procName = item.portInfo.processName;
      } else {
        // Prompt for port
        const input = await vscode.window.showInputBox({
          prompt: 'Enter port number to kill (e.g. 3000, 5173, 8080)',
          validateInput: val => (/^\d+$/.test(val) ? null : 'Please enter a valid numeric port')
        });
        if (input) {
          targetPort = parseInt(input, 10);
        }
      }

      if (!targetPort) return;

      let result;
      if (targetPid) {
        result = await killer.killProcessTree(targetPid, procName, targetPort);
      } else {
        result = await killer.killPort(targetPort);
      }

      if (result.success) {
        vscode.window.showInformationMessage(`⚡ Super Port: Killed process occupying port :${targetPort}!`);
        await refreshAll();
      } else {
        vscode.window.showErrorMessage(`Failed to kill port :${targetPort}: ${result.message}`);
      }
    }),

    vscode.commands.registerCommand('super-port.killAllDevPorts', async () => {
      const ports = await scanner.scanListeningPorts({ includeSystemPorts: false });
      const devPorts = ports.filter(p => p.isDevServer);

      if (devPorts.length === 0) {
        vscode.window.showInformationMessage('Super Port: No active dev servers to kill.');
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to terminate all ${devPorts.length} running dev servers?`,
        { modal: true },
        'Kill All Dev Ports'
      );

      if (confirm === 'Kill All Dev Ports') {
        const results = await killer.killAllDevPorts(devPorts);
        const successCount = results.filter(r => r.success).length;
        vscode.window.showInformationMessage(`⚡ Super Port: Successfully killed ${successCount} dev servers!`);
        await refreshAll();
      }
    }),

    vscode.commands.registerCommand('super-port.restartPort', async (item?: SuperPortTreeItem) => {
      if (!item || !item.portInfo) return;
      const port = item.portInfo.port;
      const restartRes = await restarter.prepareRestart(port);

      if (restartRes.success) {
        vscode.window.showInformationMessage(`🔄 Super Port: Port :${port} cleared! Ready to restart.`);
        await refreshAll();
      } else {
        vscode.window.showErrorMessage(`Failed to restart :${port}: ${restartRes.message}`);
      }
    }),

    vscode.commands.registerCommand('super-port.openBrowser', (item?: SuperPortTreeItem) => {
      if (!item || !item.portInfo) return;
      vscode.env.openExternal(vscode.Uri.parse(item.portInfo.url));
    }),

    vscode.commands.registerCommand('super-port.copyUrl', async (item?: SuperPortTreeItem) => {
      if (!item || !item.portInfo) return;
      await vscode.env.clipboard.writeText(item.portInfo.url);
      vscode.window.showInformationMessage(`Copied ${item.portInfo.url} to clipboard.`);
    }),

    vscode.commands.registerCommand('super-port.inspectTraffic', async (item?: SuperPortTreeItem) => {
      if (!item || !item.portInfo) return;
      SuperPortWebviewDashboard.createOrShow(
        context.extensionUri,
        scanner,
        killer,
        trafficInspector,
        restarter
      );
      // Let webview initialize then open traffic modal
      setTimeout(() => {
        if (SuperPortWebviewDashboard.currentPanel) {
          trafficInspector.inspectPortTraffic(item.portInfo.port).then(traffic => {
            SuperPortWebviewDashboard.currentPanel?.refreshData();
          });
        }
      }, 300);
    })
  );

  // Setup auto-refresh timer based on settings
  const config = vscode.workspace.getConfiguration('superPort');
  const intervalSeconds = config.get<number>('autoRefreshInterval', 3);
  if (intervalSeconds > 0) {
    autoRefreshTimer = setInterval(refreshAll, intervalSeconds * 1000);
  }

  // Initial scan
  refreshAll();
}

export function deactivate() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
}
