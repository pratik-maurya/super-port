import * as vscode from 'vscode';
import { CollisionSentinel } from '../core/collision-sentinel';
import { ProcessKiller } from '../core/process-killer';
import { PortScanner } from '../core/port-scanner';

export class TerminalMonitor {
  private killer: ProcessKiller;
  private scanner: PortScanner;
  private disposables: vscode.Disposable[] = [];
  private lastAlertedPort: number = 0;
  private lastAlertTime: number = 0;

  constructor(killer: ProcessKiller, scanner: PortScanner) {
    this.killer = killer;
    this.scanner = scanner;
    this.registerListeners();
  }

  private registerListeners(): void {
    // Monitor tasks completion for error codes
    const taskEndSub = vscode.tasks.onDidEndTaskProcess(async e => {
      if (e.exitCode !== 0) {
        // A dev server task failed, check if any collision occurred
        this.checkPossibleCollisions();
      }
    });

    this.disposables.push(taskEndSub);
  }

  /**
   * Can be invoked when text with EADDRINUSE is fed or detected
   */
  public async handleRawLog(text: string): Promise<void> {
    const match = CollisionSentinel.detectCollision(text);
    if (match) {
      await this.triggerCollisionAlert(match.port, match.rawError);
    }
  }

  public async triggerCollisionAlert(port: number, rawError?: string): Promise<void> {
    const now = Date.now();
    // Throttle duplicate alerts within 5 seconds for the same port
    if (this.lastAlertedPort === port && now - this.lastAlertTime < 5000) {
      return;
    }

    this.lastAlertedPort = port;
    this.lastAlertTime = now;

    const ports = await this.scanner.scanListeningPorts({ includeSystemPorts: true });
    const occupying = ports.find(p => p.port === port);

    const procDesc = occupying
      ? `${occupying.processName} (PID ${occupying.pid}, ${occupying.framework.name})`
      : `Ghost Process`;

    const message = `⚡ Super Port: Port ${port} collision! Occupied by ${procDesc}.`;

    const action = await vscode.window.showErrorMessage(
      message,
      `⚡ Kill Port ${port}`,
      'Open Inspector',
      'Ignore'
    );

    if (action === `⚡ Kill Port ${port}`) {
      const result = await this.killer.killPort(port);
      if (result.success) {
        vscode.window.showInformationMessage(`✅ Super Port: Port ${port} killed & freed! Ready to re-run server.`);
      } else {
        vscode.window.showErrorMessage(`Failed to kill port ${port}: ${result.message}`);
      }
    } else if (action === 'Open Inspector') {
      vscode.commands.executeCommand('super-port.showDashboard');
    }
  }

  private async checkPossibleCollisions(): Promise<void> {
    // Check if standard dev ports have ghost servers
    const ports = await this.scanner.scanListeningPorts({ includeSystemPorts: false });
    const devPorts = ports.filter(p => p.isDevServer);
    if (devPorts.length > 0) {
      // Quiet background check
    }
  }

  public dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
