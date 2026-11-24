import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { PortInfo, DevFrameworkInfo } from './types';
import { detectFramework } from './framework-detector';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface ProcessMetadata {
  pid: number;
  name: string;
  commandLine: string;
  executablePath: string;
  memoryBytes: number;
  cachedAt: number;
}

export class PortScanner {
  private processCache: Map<number, ProcessMetadata> = new Map();
  private cacheTtlMs = 3000;

  public formatMemory(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${Math.round(bytes / 1024)} KB`;
    }
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  }

  /**
   * Scans all listening ports on the operating system.
   * Optimized for Windows with netstat -ano and fast process resolution.
   */
  public async scanListeningPorts(options?: { includeSystemPorts?: boolean }): Promise<PortInfo[]> {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      return this.scanWindowsPorts(options);
    } else {
      return this.scanUnixPorts(options);
    }
  }

  /**
   * Fast Windows port scanner using netstat -ano -p tcp and WMI/CIM caching
   */
  private async scanWindowsPorts(options?: { includeSystemPorts?: boolean }): Promise<PortInfo[]> {
    try {
      const { stdout: netstatOut } = await execAsync('netstat -ano -p tcp', {
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true
      });

      const lines = netstatOut.split(/\r?\n/);
      const listeningMap = new Map<number, { localAddress: string; port: number; pid: number }>();
      const connectionCountMap = new Map<number, number>();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('TCP')) continue;

        const parts = trimmed.split(/\s+/);
        if (parts.length < 5) continue;

        const [, localAddr, , state, pidStr] = parts;
        const pid = parseInt(pidStr, 10);
        if (isNaN(pid)) continue;

        const parsedLocal = this.parseAddress(localAddr);
        if (!parsedLocal) continue;

        if (state.toUpperCase() === 'LISTENING') {
          // Avoid duplicate port entries (e.g. 0.0.0.0 and [::] on the same port and PID)
          if (!listeningMap.has(parsedLocal.port) || parsedLocal.address === '127.0.0.1' || parsedLocal.address === '0.0.0.0') {
            listeningMap.set(parsedLocal.port, {
              localAddress: parsedLocal.address,
              port: parsedLocal.port,
              pid
            });
          }
        } else if (state.toUpperCase() === 'ESTABLISHED') {
          const currentCount = connectionCountMap.get(parsedLocal.port) || 0;
          connectionCountMap.set(parsedLocal.port, currentCount + 1);
        }
      }

      const pidsNeeded = new Set<number>();
      for (const item of listeningMap.values()) {
        if (item.pid > 0) {
          pidsNeeded.add(item.pid);
        }
      }

      // Resolve processes for needed PIDs
      const processMap = await this.resolveProcessesBatch(Array.from(pidsNeeded));

      const portInfos: PortInfo[] = [];

      for (const item of listeningMap.values()) {
        const port = item.port;
        const isSystemPort = port < 1024;
        if (!options?.includeSystemPorts && isSystemPort) {
          continue;
        }

        const proc = processMap.get(item.pid) || {
          pid: item.pid,
          name: item.pid === 0 ? 'System Idle Process' : item.pid === 4 ? 'System' : 'Unknown',
          commandLine: '',
          executablePath: '',
          memoryBytes: 0,
          cachedAt: Date.now()
        };

        const framework = detectFramework({
          port,
          processName: proc.name,
          commandLine: proc.commandLine,
          executablePath: proc.executablePath
        });

        const isDevServer =
          framework.category === 'dev-server' ||
          framework.category === 'api-runtime' ||
          framework.category === 'docker' ||
          [3000, 3001, 3002, 3003, 4000, 4200, 5000, 5173, 5174, 5175, 8000, 8080, 8081, 8888, 9000].includes(port);

        const url = `http://localhost:${port}`;
        const activeConnectionsCount = connectionCountMap.get(port) || 0;

        portInfos.push({
          port,
          protocol: 'tcp',
          pid: item.pid,
          processName: proc.name,
          commandLine: proc.commandLine,
          executablePath: proc.executablePath,
          localAddress: item.localAddress,
          memoryBytes: proc.memoryBytes,
          memoryFormatted: this.formatMemory(proc.memoryBytes),
          framework,
          url,
          status: 'LISTENING',
          activeConnectionsCount,
          detectedAt: Date.now(),
          isDevServer,
          isSystemPort
        });
      }

      // Sort with Dev servers first, then sorted by port number
      portInfos.sort((a, b) => {
        if (a.isDevServer && !b.isDevServer) return -1;
        if (!a.isDevServer && b.isDevServer) return 1;
        return a.port - b.port;
      });

      return portInfos;
    } catch (err: any) {
      console.error('Error in scanWindowsPorts:', err);
      return [];
    }
  }

  /**
   * Resolves process details for a batch of PIDs with caching.
   */
  private async resolveProcessesBatch(pids: number[]): Promise<Map<number, ProcessMetadata>> {
    const result = new Map<number, ProcessMetadata>();
    const missingPids: number[] = [];
    const now = Date.now();

    for (const pid of pids) {
      const cached = this.processCache.get(pid);
      if (cached && now - cached.cachedAt < this.cacheTtlMs) {
        result.set(pid, cached);
      } else {
        missingPids.push(pid);
      }
    }

    if (missingPids.length === 0) {
      return result;
    }

    // Step 1: Use tasklist for fast name and memory resolution
    try {
      const { stdout: tasklistOut } = await execAsync('tasklist /FO CSV /NH', {
        maxBuffer: 5 * 1024 * 1024,
        windowsHide: true
      });

      const lines = tasklistOut.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        const matches = line.match(/^"([^"]+)","(\d+)",.*,"([^"]+)"$/);
        if (matches) {
          const [, name, pidStr, memStr] = matches;
          const pid = parseInt(pidStr, 10);
          if (missingPids.includes(pid)) {
            // Memory in tasklist is in KB, e.g., "54,230 K"
            const memKb = parseInt(memStr.replace(/[^0-9]/g, ''), 10) || 0;
            const meta: ProcessMetadata = {
              pid,
              name,
              commandLine: '',
              executablePath: '',
              memoryBytes: memKb * 1024,
              cachedAt: now
            };
            result.set(pid, meta);
            this.processCache.set(pid, meta);
          }
        }
      }
    } catch {
      // tasklist fallback
    }

    // Step 2: Query CommandLine & Path via PowerShell for node/python/dev processes or missing commandlines
    const pidsNeedingDetails = missingPids.filter(pid => {
      const existing = result.get(pid);
      if (!existing) return true;
      const lower = existing.name.toLowerCase();
      return lower.includes('node') || lower.includes('python') || lower.includes('bun') || lower.includes('deno') || lower.includes('docker') || lower.includes('java');
    });

    if (pidsNeedingDetails.length > 0) {
      try {
        const filterStr = pidsNeedingDetails.map(p => `ProcessId = ${p}`).join(' or ');
        const psCmd = `Get-CimInstance Win32_Process -Filter "${filterStr}" | Select-Object ProcessId, Name, CommandLine, ExecutablePath, WorkingSetSize | ConvertTo-Json -Compress`;
        const { stdout: psOut } = await execAsync(`powershell -NoProfile -Command "${psCmd}"`, {
          maxBuffer: 5 * 1024 * 1024,
          windowsHide: true
        });

        if (psOut.trim()) {
          const parsed = JSON.parse(psOut);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          for (const item of list) {
            if (!item || !item.ProcessId) continue;
            const pid = item.ProcessId;
            const existing = result.get(pid);
            const updated: ProcessMetadata = {
              pid,
              name: item.Name || existing?.name || 'Unknown',
              commandLine: item.CommandLine || existing?.commandLine || '',
              executablePath: item.ExecutablePath || existing?.executablePath || '',
              memoryBytes: item.WorkingSetSize || existing?.memoryBytes || 0,
              cachedAt: now
            };
            result.set(pid, updated);
            this.processCache.set(pid, updated);
          }
        }
      } catch {
        // PowerShell CIM query is optional enhancement
      }
    }

    return result;
  }

  /**
   * Unix / macOS fallback using lsof or netstat
   */
  private async scanUnixPorts(options?: { includeSystemPorts?: boolean }): Promise<PortInfo[]> {
    try {
      const { stdout } = await execAsync('lsof -iTCP -sTCP:LISTEN -P -n -F pcnT', { maxBuffer: 5 * 1024 * 1024 });
      const portInfos: PortInfo[] = [];
      const lines = stdout.split('\n');

      let currentPid = 0;
      let currentCmd = '';

      for (const line of lines) {
        if (line.startsWith('p')) {
          currentPid = parseInt(line.substring(1), 10);
        } else if (line.startsWith('c')) {
          currentCmd = line.substring(1);
        } else if (line.startsWith('n')) {
          const endpoint = line.substring(1);
          const portMatch = endpoint.match(/:(\d+)$/);
          if (portMatch) {
            const port = parseInt(portMatch[1], 10);
            if (!options?.includeSystemPorts && port < 1024) continue;

            const framework = detectFramework({
              port,
              processName: currentCmd,
              commandLine: currentCmd,
              executablePath: ''
            });

            portInfos.push({
              port,
              protocol: 'tcp',
              pid: currentPid,
              processName: currentCmd,
              commandLine: currentCmd,
              executablePath: '',
              localAddress: endpoint.substring(0, endpoint.lastIndexOf(':')),
              memoryBytes: 0,
              memoryFormatted: 'N/A',
              framework,
              url: `http://localhost:${port}`,
              status: 'LISTENING',
              activeConnectionsCount: 0,
              detectedAt: Date.now(),
              isDevServer: framework.category === 'dev-server' || framework.category === 'api-runtime',
              isSystemPort: port < 1024
            });
          }
        }
      }

      return portInfos;
    } catch {
      return [];
    }
  }

  /**
   * Parses IPv4 and IPv6 addresses and port from netstat string
   */
  public parseAddress(raw: string): { address: string; port: number } | null {
    if (!raw) return null;
    const clean = raw.trim();

    // Check for IPv6 format: [::1]:3000 or [::]:3000 or :::3000 or ::1:3000
    if (clean.includes('[')) {
      const match = clean.match(/\[([^\]]+)\]:(\d+)$/);
      if (match) {
        return { address: match[1], port: parseInt(match[2], 10) };
      }
    }

    const lastColon = clean.lastIndexOf(':');
    if (lastColon === -1) return null;

    const address = clean.substring(0, lastColon);
    const port = parseInt(clean.substring(lastColon + 1), 10);

    if (isNaN(port)) return null;

    return { address: address || '0.0.0.0', port };
  }
}
