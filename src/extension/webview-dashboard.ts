import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { PortScanner } from '../core/port-scanner';
import { ProcessKiller } from '../core/process-killer';
import { TrafficInspector } from '../core/traffic-inspector';
import { ServerRestarter } from '../core/server-restarter';
import { PortInfo } from '../core/types';

export class SuperPortWebviewDashboard {
  public static currentPanel: SuperPortWebviewDashboard | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];
  private autoRefreshTimer: NodeJS.Timeout | null = null;

  private scanner: PortScanner;
  private killer: ProcessKiller;
  private trafficInspector: TrafficInspector;
  private restarter: ServerRestarter;

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    scanner: PortScanner,
    killer: ProcessKiller,
    trafficInspector: TrafficInspector,
    restarter: ServerRestarter
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.scanner = scanner;
    this.killer = killer;
    this.trafficInspector = trafficInspector;
    this.restarter = restarter;

    this.panel.webview.html = this.getHtmlForWebview(this.panel.webview);

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      async message => {
        await this.handleWebviewMessage(message);
      },
      null,
      this.disposables
    );

    // Initial scan and load
    this.refreshData();

    // Start auto-refresh timer (default 3 seconds)
    this.startAutoRefresh(3000);
  }

  public static createOrShow(
    extensionUri: vscode.Uri,
    scanner: PortScanner,
    killer: ProcessKiller,
    trafficInspector: TrafficInspector,
    restarter: ServerRestarter
  ): SuperPortWebviewDashboard {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (SuperPortWebviewDashboard.currentPanel) {
      SuperPortWebviewDashboard.currentPanel.panel.reveal(column);
      SuperPortWebviewDashboard.currentPanel.refreshData();
      return SuperPortWebviewDashboard.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'superPortDashboard',
      '⚡ Super Port: Traffic & Dev Port Killer',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'resources'),
          vscode.Uri.joinPath(extensionUri, 'out', 'webview'),
          vscode.Uri.joinPath(extensionUri, 'src', 'webview')
        ]
      }
    );

    SuperPortWebviewDashboard.currentPanel = new SuperPortWebviewDashboard(
      panel,
      extensionUri,
      scanner,
      killer,
      trafficInspector,
      restarter
    );

    return SuperPortWebviewDashboard.currentPanel;
  }

  public async refreshData(): Promise<void> {
    try {
      const ports = await this.scanner.scanListeningPorts({ includeSystemPorts: true });
      this.postMessage({
        type: 'portsUpdate',
        ports,
        timestamp: Date.now()
      });
    } catch (err: any) {
      this.postMessage({
        type: 'error',
        message: err.message || 'Failed to scan ports'
      });
    }
  }

  private startAutoRefresh(intervalMs: number): void {
    this.stopAutoRefresh();
    if (intervalMs > 0) {
      this.autoRefreshTimer = setInterval(() => {
        this.refreshData();
      }, intervalMs);
    }
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  private async handleWebviewMessage(message: any): Promise<void> {
    switch (message.command) {
      case 'refresh': {
        await this.refreshData();
        break;
      }
      case 'kill': {
        const { pid, processName, port } = message;
        const result = await this.killer.killProcessTree(pid, processName, port);
        if (result.success) {
          vscode.window.showInformationMessage(`⚡ Super Port: Killed process ${pid} on port :${port}!`);
          this.postMessage({
            type: 'toast',
            message: `Killed process ${pid} on port :${port}`,
            severity: 'success'
          });
          await this.refreshData();
        } else {
          vscode.window.showErrorMessage(`Failed to kill process: ${result.message}`);
          this.postMessage({
            type: 'toast',
            message: result.message,
            severity: 'error'
          });
        }
        break;
      }
      case 'killAllDev': {
        const ports = await this.scanner.scanListeningPorts({ includeSystemPorts: false });
        const devPorts = ports.filter(p => p.isDevServer);
        if (devPorts.length === 0) {
          vscode.window.showInformationMessage('Super Port: No active dev servers to kill.');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Kill all ${devPorts.length} running dev servers?`,
          { modal: true },
          'Kill All'
        );

        if (confirm === 'Kill All') {
          const results = await this.killer.killAllDevPorts(devPorts);
          const successCount = results.filter(r => r.success).length;
          vscode.window.showInformationMessage(`⚡ Super Port: Terminated ${successCount} dev servers.`);
          this.postMessage({
            type: 'toast',
            message: `Terminated ${successCount} dev servers.`,
            severity: 'success'
          });
          await this.refreshData();
        }
        break;
      }
      case 'restart': {
        const { port } = message;
        const restartRes = await this.restarter.prepareRestart(port);
        if (restartRes.success) {
          vscode.window.showInformationMessage(`🔄 Super Port: Port :${port} freed for restart!`);
          this.postMessage({
            type: 'toast',
            message: `Port :${port} freed for restart!`,
            severity: 'success'
          });
          await this.refreshData();
        } else {
          vscode.window.showErrorMessage(`Failed to restart: ${restartRes.message}`);
        }
        break;
      }
      case 'inspectTraffic': {
        const { port } = message;
        const traffic = await this.trafficInspector.inspectPortTraffic(port);
        this.postMessage({
          type: 'trafficUpdate',
          traffic
        });
        break;
      }
      case 'openBrowser': {
        const { url } = message;
        if (url) {
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
        break;
      }
      case 'copyUrl': {
        const { url } = message;
        if (url) {
          await vscode.env.clipboard.writeText(url);
          vscode.window.showInformationMessage(`Copied ${url} to clipboard.`);
          this.postMessage({
            type: 'toast',
            message: `Copied ${url} to clipboard`,
            severity: 'info'
          });
        }
        break;
      }
      case 'setAutoRefresh': {
        const { enabled, interval } = message;
        if (enabled) {
          this.startAutoRefresh(interval || 3000);
        } else {
          this.stopAutoRefresh();
        }
        break;
      }
    }
  }

  private postMessage(message: any): void {
    this.panel.webview.postMessage(message);
  }

  public dispose(): void {
    SuperPortWebviewDashboard.currentPanel = undefined;
    this.stopAutoRefresh();
    this.panel.dispose();

    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Try to load from src/webview/index.html or provide bundled template
    const htmlPath = path.join(this.extensionUri.fsPath, 'src', 'webview', 'index.html');
    if (fs.existsSync(htmlPath)) {
      let html = fs.readFileSync(htmlPath, 'utf8');

      // Resolve webview URIs for style and script
      const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'styles.css'));
      const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'app.js'));

      html = html.replace('href="styles.css"', `href="${styleUri}"`);
      html = html.replace('src="app.js"', `src="${scriptUri}"`);
      return html;
    }

    return `<!DOCTYPE html><html><body>Error loading Super Port Webview template.</body></html>`;
  }
}
