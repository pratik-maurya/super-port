import { exec } from 'child_process';
import { promisify } from 'util';
import { KillResult, PortInfo } from './types';
import { PortScanner } from './port-scanner';

const execAsync = promisify(exec);

export class ProcessKiller {
  private scanner: PortScanner;

  constructor(scanner?: PortScanner) {
    this.scanner = scanner || new PortScanner();
  }

  /**
   * Protected PIDs that should NEVER be killed (System, System Idle Process, etc.)
   */
  private isProtectedPid(pid: number, processName?: string): boolean {
    if (pid <= 4) return true;
    if (processName) {
      const lower = processName.toLowerCase();
      if (
        lower === 'system' ||
        lower === 'system idle process' ||
        lower === 'services.exe' ||
        lower === 'svchost.exe' ||
        lower === 'smss.exe' ||
        lower === 'csrss.exe' ||
        lower === 'wininit.exe' ||
        lower === 'lsass.exe'
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Kills a process and its entire child tree.
   * On Windows: uses taskkill /PID <PID> /F /T
   */
  public async killProcessTree(pid: number, processName?: string, port?: number): Promise<KillResult> {
    if (this.isProtectedPid(pid, processName)) {
      return {
        success: false,
        pid,
        port,
        processName,
        message: `Refused to kill protected system process: ${processName || pid}`,
        killedTree: false,
        error: 'PROTECTED_SYSTEM_PROCESS'
      };
    }

    const isWindows = process.platform === 'win32';

    if (isWindows) {
      try {
        // /F = Force, /T = Tree (all child processes spawned by dev servers like npm/node/vite)
        const cmd = `taskkill /PID ${pid} /F /T`;
        await execAsync(cmd, { windowsHide: true });

        // Verify port status if port was provided
        let freedPort = true;
        if (port) {
          freedPort = await this.verifyPortFreed(port, 1000);
        }

        return {
          success: true,
          pid,
          port,
          processName,
          message: `Successfully killed process ${pid} (${processName || 'dev server'}) and process tree.`,
          killedTree: true,
          freedPort
        };
      } catch (err: any) {
        // Fallback to PowerShell Stop-Process
        try {
          await execAsync(`powershell -NoProfile -Command "Stop-Process -Id ${pid} -Force"`, {
            windowsHide: true
          });

          let freedPort = true;
          if (port) {
            freedPort = await this.verifyPortFreed(port, 1000);
          }

          return {
            success: true,
            pid,
            port,
            processName,
            message: `Killed process ${pid} using PowerShell fallback.`,
            killedTree: false,
            freedPort
          };
        } catch (fallbackErr: any) {
          return {
            success: false,
            pid,
            port,
            processName,
            message: `Failed to kill process ${pid}: ${err.message || fallbackErr.message}`,
            killedTree: false,
            error: err.message
          };
        }
      }
    } else {
      // Unix / macOS kill
      try {
        await execAsync(`kill -9 ${pid}`);
        return {
          success: true,
          pid,
          port,
          processName,
          message: `Killed process ${pid} via SIGKILL.`,
          killedTree: false,
          freedPort: true
        };
      } catch (err: any) {
        return {
          success: false,
          pid,
          port,
          processName,
          message: `Failed to kill process ${pid}: ${err.message}`,
          killedTree: false,
          error: err.message
        };
      }
    }
  }

  /**
   * Kills any process occupying a given port.
   */
  public async killPort(port: number): Promise<KillResult> {
    const ports = await this.scanner.scanListeningPorts({ includeSystemPorts: true });
    const target = ports.find(p => p.port === port);

    if (!target) {
      return {
        success: true,
        pid: 0,
        port,
        message: `Port ${port} is not occupied. Already free!`,
        killedTree: false,
        freedPort: true
      };
    }

    return this.killProcessTree(target.pid, target.processName, port);
  }

  /**
   * 1-Click "Kill All Dev Ports"
   * Kills all running dev servers (Vite, Next.js, Angular, Python, etc.)
   */
  public async killAllDevPorts(candidatePorts?: PortInfo[]): Promise<KillResult[]> {
    const ports = candidatePorts || (await this.scanner.scanListeningPorts({ includeSystemPorts: false }));
    const devPorts = ports.filter(p => p.isDevServer && !this.isProtectedPid(p.pid, p.processName));

    if (devPorts.length === 0) {
      return [];
    }

    // Deduplicate PIDs to avoid redundant kills
    const seenPids = new Set<number>();
    const uniqueTargets: PortInfo[] = [];

    for (const p of devPorts) {
      if (!seenPids.has(p.pid)) {
        seenPids.add(p.pid);
        uniqueTargets.push(p);
      }
    }

    const results = await Promise.all(
      uniqueTargets.map(target => this.killProcessTree(target.pid, target.processName, target.port))
    );

    return results;
  }

  /**
   * Polls briefly to verify if a port has been freed
   */
  private async verifyPortFreed(port: number, timeoutMs: number = 1000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await new Promise(r => setTimeout(r, 150));
      const currentPorts = await this.scanner.scanListeningPorts({ includeSystemPorts: true });
      const stillOccupied = currentPorts.some(p => p.port === port);
      if (!stillOccupied) {
        return true;
      }
    }
    return false;
  }
}
