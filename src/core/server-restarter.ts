import { ProcessKiller } from './process-killer';
import { PortScanner } from './port-scanner';
import { RestartResult } from './types';

export class ServerRestarter {
  private killer: ProcessKiller;
  private scanner: PortScanner;
  private serverHistory: Map<number, { commandLine: string; cwd?: string; terminalName?: string }> = new Map();

  constructor(killer?: ProcessKiller, scanner?: PortScanner) {
    this.scanner = scanner || new PortScanner();
    this.killer = killer || new ProcessKiller(this.scanner);
  }

  /**
   * Records known startup command or context for a port
   */
  public registerServer(port: number, commandLine: string, cwd?: string, terminalName?: string): void {
    this.serverHistory.set(port, { commandLine, cwd, terminalName });
  }

  /**
   * Kills the current process on the port and returns the recorded restart command
   */
  public async prepareRestart(port: number): Promise<RestartResult> {
    const ports = await this.scanner.scanListeningPorts({ includeSystemPorts: true });
    const target = ports.find(p => p.port === port);

    if (!target) {
      return {
        success: false,
        port,
        killedPid: 0,
        message: `Port ${port} is not running.`,
        error: 'PORT_NOT_RUNNING'
      };
    }

    const commandLine = this.serverHistory.get(port)?.commandLine || target.commandLine;

    const killResult = await this.killer.killProcessTree(target.pid, target.processName, port);

    if (!killResult.success) {
      return {
        success: false,
        port,
        killedPid: target.pid,
        message: `Failed to terminate existing process on port ${port}: ${killResult.message}`,
        error: killResult.error
      };
    }

    return {
      success: true,
      port,
      killedPid: target.pid,
      commandExecuted: commandLine,
      message: `Killed process on port ${port}. Ready to restart.`
    };
  }
}
