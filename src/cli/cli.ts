import { PortScanner } from '../core/port-scanner';
import { ProcessKiller } from '../core/process-killer';
import { TrafficInspector } from '../core/traffic-inspector';
import { StandaloneServer } from './standalone-server';

// ANSI styling colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgCyan: '\x1b[46m'
};

export async function runCli(args: string[]): Promise<void> {
  const scanner = new PortScanner();
  const killer = new ProcessKiller(scanner);
  const trafficInspector = new TrafficInspector(scanner);

  const command = args[0]?.toLowerCase() || 'ls';

  switch (command) {
    case 'ls':
    case 'list':
    case 'status': {
      console.log(`\n${c.bold}${c.cyan}⚡ SUPER PORT${c.reset} — ${c.dim}Dev Port Killer & Traffic Inspector${c.reset}\n`);
      const includeAll = args.includes('--all') || args.includes('-a');
      const ports = await scanner.scanListeningPorts({ includeSystemPorts: includeAll });

      if (ports.length === 0) {
        console.log(`${c.yellow}No active listening ports detected.${c.reset}\n`);
        return;
      }

      const devPorts = ports.filter(p => p.isDevServer);
      const otherPorts = ports.filter(p => !p.isDevServer);

      console.log(`${c.bold}${c.green}⚡ ACTIVE DEV SERVERS (${devPorts.length})${c.reset}`);
      console.log('─'.repeat(85));
      console.log(
        `${c.bold}PORT   FRAMEWORK                PROCESS         PID      MEMORY      URL${c.reset}`
      );
      console.log('─'.repeat(85));

      if (devPorts.length === 0) {
        console.log(`${c.dim}  No dev servers running (Vite, Next.js, Angular, Python, etc.)${c.reset}`);
      } else {
        for (const p of devPorts) {
          const portStr = `:${p.port}`.padEnd(6);
          const fwStr = `${p.framework.icon} ${p.framework.name}`.padEnd(24);
          const procStr = p.processName.substring(0, 14).padEnd(15);
          const pidStr = p.pid.toString().padEnd(8);
          const memStr = p.memoryFormatted.padEnd(11);
          const urlStr = `${c.cyan}${p.url}${c.reset}`;

          console.log(`${c.bold}${c.yellow}${portStr}${c.reset} ${fwStr} ${procStr} ${pidStr} ${memStr} ${urlStr}`);
        }
      }

      console.log('─'.repeat(85));

      if (includeAll && otherPorts.length > 0) {
        console.log(`\n${c.bold}🌐 OTHER LISTENING PORTS (${otherPorts.length})${c.reset}`);
        console.log('─'.repeat(85));
        for (const p of otherPorts) {
          const portStr = `:${p.port}`.padEnd(6);
          const nameStr = p.processName.substring(0, 20).padEnd(22);
          const pidStr = p.pid.toString().padEnd(8);
          const memStr = p.memoryFormatted.padEnd(12);
          const addr = `${p.localAddress}:${p.port}`;
          console.log(`${portStr} ${nameStr} PID ${pidStr} ${memStr} ${c.dim}${addr}${c.reset}`);
        }
        console.log('─'.repeat(85));
      } else if (!includeAll && otherPorts.length > 0) {
        console.log(`${c.dim}  + ${otherPorts.length} system / background ports (use --all to show all)${c.reset}`);
      }

      console.log(`\n${c.dim}Commands: super-port kill <port> | super-port kill-all | super-port ui${c.reset}\n`);
      break;
    }

    case 'kill': {
      const portArg = args[1];
      if (!portArg || isNaN(parseInt(portArg, 10))) {
        console.error(`${c.red}Error: Please specify a port number to kill, e.g. super-port kill 3000${c.reset}`);
        process.exit(1);
      }

      const port = parseInt(portArg, 10);
      console.log(`\n${c.yellow}⚡ Terminating process tree occupying port :${port}...${c.reset}`);
      const result = await killer.killPort(port);

      if (result.success) {
        console.log(`${c.green}${c.bold}✅ Success: ${result.message}${c.reset}\n`);
      } else {
        console.error(`${c.red}❌ Failed: ${result.message}${c.reset}\n`);
        process.exit(1);
      }
      break;
    }

    case 'kill-all':
    case 'killall': {
      console.log(`\n${c.yellow}⚡ Scanning and terminating all active dev server processes...${c.reset}`);
      const results = await killer.killAllDevPorts();

      if (results.length === 0) {
        console.log(`${c.green}No active dev servers found. Ports are all clear!${c.reset}\n`);
        return;
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`${c.green}${c.bold}✅ Successfully killed ${successCount} dev server process trees!${c.reset}\n`);
      for (const r of results) {
        const icon = r.success ? '✔' : '✖';
        console.log(`  ${icon} PID ${r.pid} (${r.processName || 'dev server'}): ${r.message}`);
      }
      console.log('');
      break;
    }

    case 'traffic':
    case 'inspect': {
      const portArg = args[1];
      if (!portArg || isNaN(parseInt(portArg, 10))) {
        console.error(`${c.red}Error: Please specify a port to inspect, e.g. super-port traffic 3000${c.reset}`);
        process.exit(1);
      }

      const port = parseInt(portArg, 10);
      console.log(`\n${c.cyan}📡 Inspecting traffic for port :${port}...${c.reset}`);
      const traffic = await trafficInspector.inspectPortTraffic(port);

      console.log(`\n${c.bold}Port :${traffic.port} (${traffic.frameworkName}) — PID ${traffic.listeningPid} [${traffic.processName}]${c.reset}`);
      console.log(`  Total Active Connections: ${c.bold}${traffic.totalConnections}${c.reset}`);
      console.log(`  Established: ${c.green}${traffic.establishedCount}${c.reset} | Time-Wait: ${c.yellow}${traffic.timeWaitCount}${c.reset} | Close-Wait: ${c.red}${traffic.closeWaitCount}${c.reset}`);
      console.log(`  Unique Client IPs: ${traffic.uniqueRemoteIps.join(', ') || 'None'}\n`);

      if (traffic.connections.length > 0) {
        console.log(`${c.bold}STATE            LOCAL ENDPOINT          REMOTE CLIENT${c.reset}`);
        console.log('─'.repeat(60));
        for (const conn of traffic.connections) {
          const stateStr = conn.state.padEnd(16);
          const local = `${conn.localAddress}:${conn.localPort}`.padEnd(23);
          const remote = `${conn.remoteAddress}:${conn.remotePort}`;
          console.log(`${stateStr} ${local} ${remote}`);
        }
        console.log('─'.repeat(60) + '\n');
      }
      break;
    }

    case 'ui':
    case 'serve':
    case 'tray':
    case 'dashboard': {
      const server = new StandaloneServer();
      const port = await server.start(49152);
      const url = `http://localhost:${port}`;

      console.log(`\n${c.bold}${c.green}⚡ Super Port Dashboard running at:${c.reset} ${c.cyan}${c.bold}${url}${c.reset}`);
      console.log(`${c.dim}Opening dashboard in your default browser... (Press Ctrl+C to exit)${c.reset}\n`);

      server.openBrowser(url);
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default: {
      console.log(`
${c.bold}${c.cyan}⚡ SUPER PORT${c.reset} — Dev Port Killer & Traffic Inspector

${c.bold}USAGE:${c.reset}
  super-port [command] [options]

${c.bold}COMMANDS:${c.reset}
  ${c.green}ls, list${c.reset}                 List all active dev servers, ports, memory, and PIDs (Default)
  ${c.green}kill <port>${c.reset}              1-Click force kill process tree occupying a port
  ${c.green}kill-all${c.reset}                 Kill ALL active dev servers (Vite, Next, Angular, etc.)
  ${c.green}traffic <port>${c.reset}           Inspect live TCP connections and remote clients on a port
  ${c.green}ui, tray, serve${c.reset}          Launch standalone visual Web Dashboard & Tray companion

${c.bold}OPTIONS:${c.reset}
  ${c.yellow}--all, -a${c.reset}                Include system and background ports in listing
  ${c.yellow}--help, -h${c.reset}               Show this help message

${c.bold}EXAMPLES:${c.reset}
  $ super-port
  $ super-port kill 3000
  $ super-port kill-all
  $ super-port traffic 5173
  $ super-port ui
`);
      break;
    }
  }
}
