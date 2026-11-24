export type DevFrameworkCategory = 'dev-server' | 'database' | 'docker' | 'api-runtime' | 'system' | 'other';

export interface DevFrameworkInfo {
  id: string;
  name: string;
  icon: string;
  badgeColor: string;
  category: DevFrameworkCategory;
  description: string;
  defaultPortHint?: number;
}

export interface PortInfo {
  port: number;
  protocol: 'tcp' | 'udp';
  pid: number;
  processName: string;
  commandLine: string;
  executablePath: string;
  localAddress: string;
  memoryBytes: number;
  memoryFormatted: string;
  cpuPercent?: number;
  framework: DevFrameworkInfo;
  url: string;
  status: 'LISTENING' | 'ACTIVE';
  activeConnectionsCount: number;
  detectedAt: number;
  startTime?: string;
  isDevServer: boolean;
  isSystemPort: boolean;
}

export type TcpState = 
  | 'LISTENING' 
  | 'ESTABLISHED' 
  | 'TIME_WAIT' 
  | 'CLOSE_WAIT' 
  | 'SYN_SENT' 
  | 'SYN_RCVD' 
  | 'FIN_WAIT_1' 
  | 'FIN_WAIT_2' 
  | 'LAST_ACK' 
  | 'CLOSING' 
  | 'UNKNOWN';

export interface TrafficConnection {
  localAddress: string;
  localPort: number;
  remoteAddress: string;
  remotePort: number;
  state: TcpState;
  pid: number;
  processName?: string;
}

export interface PortTrafficSummary {
  port: number;
  listeningPid: number;
  processName: string;
  frameworkName: string;
  totalConnections: number;
  establishedCount: number;
  timeWaitCount: number;
  closeWaitCount: number;
  otherCount: number;
  uniqueRemoteIps: string[];
  connections: TrafficConnection[];
  inspectedAt: number;
}

export interface KillResult {
  success: boolean;
  pid: number;
  port?: number;
  processName?: string;
  message: string;
  killedTree: boolean;
  freedPort?: boolean;
  error?: string;
}

export interface RestartResult {
  success: boolean;
  port: number;
  killedPid: number;
  commandExecuted?: string;
  message: string;
  error?: string;
}

export interface PortCollisionMatch {
  port: number;
  rawError: string;
  matchedPattern: string;
  timestamp: number;
}
