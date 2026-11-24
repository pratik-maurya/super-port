import { exec } from 'child_process';
import { promisify } from 'util';
import { PortTrafficSummary, TrafficConnection, TcpState } from './types';
import { PortScanner } from './port-scanner';

const execAsync = promisify(exec);

export class TrafficInspector {
  private scanner: PortScanner;

  constructor(scanner?: PortScanner) {
    this.scanner = scanner || new PortScanner();
  }

  /**
   * Inspects all active incoming/outgoing connections to a specific port
   */
  public async inspectPortTraffic(port: number): Promise<PortTrafficSummary> {
    const isWindows = process.platform === 'win32';
    const allPorts = await this.scanner.scanListeningPorts({ includeSystemPorts: true });
    const portInfo = allPorts.find(p => p.port === port);

    const summary: PortTrafficSummary = {
      port,
      listeningPid: portInfo?.pid || 0,
      processName: portInfo?.processName || 'Unknown',
      frameworkName: portInfo?.framework.name || 'Unknown',
      totalConnections: 0,
      establishedCount: 0,
      timeWaitCount: 0,
      closeWaitCount: 0,
      otherCount: 0,
      uniqueRemoteIps: [],
      connections: [],
      inspectedAt: Date.now()
    };

    if (isWindows) {
      try {
        const { stdout } = await execAsync('netstat -ano -p tcp', {
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true
        });

        const lines = stdout.split(/\r?\n/);
        const remoteIpsSet = new Set<string>();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('TCP')) continue;

          const parts = trimmed.split(/\s+/);
          if (parts.length < 5) continue;

          const [, localAddr, foreignAddr, stateRaw, pidStr] = parts;
          const pid = parseInt(pidStr, 10);

          const parsedLocal = this.scanner.parseAddress(localAddr);
          const parsedForeign = this.scanner.parseAddress(foreignAddr);

          if (!parsedLocal || !parsedForeign) continue;

          // Check if this connection belongs to our target port
          if (parsedLocal.port === port || parsedForeign.port === port) {
            const state = this.normalizeState(stateRaw);

            // Filter out the LISTENING entry from traffic connections
            if (state === 'LISTENING') continue;

            const remoteIp = parsedForeign.address;
            if (remoteIp && remoteIp !== '0.0.0.0' && remoteIp !== '*' && remoteIp !== '::') {
              remoteIpsSet.add(remoteIp);
            }

            summary.connections.push({
              localAddress: parsedLocal.address,
              localPort: parsedLocal.port,
              remoteAddress: parsedForeign.address,
              remotePort: parsedForeign.port,
              state,
              pid,
              processName: pid === portInfo?.pid ? portInfo?.processName : undefined
            });

            if (state === 'ESTABLISHED') {
              summary.establishedCount++;
            } else if (state === 'TIME_WAIT') {
              summary.timeWaitCount++;
            } else if (state === 'CLOSE_WAIT') {
              summary.closeWaitCount++;
            } else {
              summary.otherCount++;
            }
          }
        }

        summary.totalConnections = summary.connections.length;
        summary.uniqueRemoteIps = Array.from(remoteIpsSet);
      } catch (err) {
        console.error('Error inspecting port traffic:', err);
      }
    }

    return summary;
  }

  private normalizeState(rawState: string): TcpState {
    const s = rawState.toUpperCase();
    if (s.includes('ESTABLISHED')) return 'ESTABLISHED';
    if (s.includes('TIME_WAIT')) return 'TIME_WAIT';
    if (s.includes('CLOSE_WAIT')) return 'CLOSE_WAIT';
    if (s.includes('LISTENING')) return 'LISTENING';
    if (s.includes('SYN_SENT')) return 'SYN_SENT';
    if (s.includes('SYN_RCVD') || s.includes('SYN_RECEIVED')) return 'SYN_RCVD';
    if (s.includes('FIN_WAIT_1')) return 'FIN_WAIT_1';
    if (s.includes('FIN_WAIT_2')) return 'FIN_WAIT_2';
    if (s.includes('LAST_ACK')) return 'LAST_ACK';
    if (s.includes('CLOSING')) return 'CLOSING';
    return 'UNKNOWN';
  }
}
