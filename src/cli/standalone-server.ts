import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { PortScanner } from '../core/port-scanner';
import { ProcessKiller } from '../core/process-killer';
import { TrafficInspector } from '../core/traffic-inspector';
import { ServerRestarter } from '../core/server-restarter';

export class StandaloneServer {
  private scanner = new PortScanner();
  private killer = new ProcessKiller(this.scanner);
  private trafficInspector = new TrafficInspector(this.scanner);
  private restarter = new ServerRestarter(this.killer, this.scanner);

  public async start(port: number = 49152): Promise<number> {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = url.pathname;

      // Enable CORS for flexibility
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      // API Routes
      if (pathname === '/api/ports') {
        const ports = await this.scanner.scanListeningPorts({ includeSystemPorts: true });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ports }));
        return;
      }

      if (pathname === '/api/kill' && req.method === 'POST') {
        const body = await this.parseJsonBody(req);
        const { pid, processName, port } = body;
        const result = await this.killer.killProcessTree(pid, processName, port);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (pathname === '/api/kill-all' && req.method === 'POST') {
        const results = await this.killer.killAllDevPorts();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
        return;
      }

      if (pathname === '/api/restart' && req.method === 'POST') {
        const body = await this.parseJsonBody(req);
        const result = await this.restarter.prepareRestart(body.port);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      if (pathname === '/api/traffic') {
        const targetPort = parseInt(url.searchParams.get('port') || '0', 10);
        const traffic = await this.trafficInspector.inspectPortTraffic(targetPort);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(traffic));
        return;
      }

      // Static assets
      const baseDir = path.resolve(__dirname, '..', 'webview');
      let filePath = path.join(baseDir, pathname === '/' ? 'index.html' : pathname);

      // Fallback to src/webview if out/webview doesn't exist yet
      if (!fs.existsSync(filePath)) {
        const srcDir = path.resolve(__dirname, '..', '..', 'src', 'webview');
        filePath = path.join(srcDir, pathname === '/' ? 'index.html' : pathname);
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png'
        };

        const contentType = mimeTypes[ext] || 'application/octet-stream';
        let content = fs.readFileSync(filePath);

        // Inject standalone backend bridge into index.html
        if (ext === '.html') {
          const bridgeScript = `
          <script>
            window.__superPortBackend = {
              onMessage: async function(msg) {
                switch(msg.command) {
                  case 'refresh': {
                    const res = await fetch('/api/ports');
                    const data = await res.json();
                    window.postMessage({ type: 'portsUpdate', ports: data.ports }, '*');
                    break;
                  }
                  case 'kill': {
                    const res = await fetch('/api/kill', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(msg)
                    });
                    const data = await res.json();
                    window.postMessage({ type: 'toast', message: data.message, severity: data.success ? 'success' : 'error' }, '*');
                    window.__superPortBackend.onMessage({ command: 'refresh' });
                    break;
                  }
                  case 'killAllDev': {
                    const res = await fetch('/api/kill-all', { method: 'POST' });
                    const data = await res.json();
                    window.postMessage({ type: 'toast', message: 'Terminated dev servers.', severity: 'success' }, '*');
                    window.__superPortBackend.onMessage({ command: 'refresh' });
                    break;
                  }
                  case 'restart': {
                    const res = await fetch('/api/restart', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(msg)
                    });
                    const data = await res.json();
                    window.postMessage({ type: 'toast', message: data.message, severity: data.success ? 'success' : 'error' }, '*');
                    window.__superPortBackend.onMessage({ command: 'refresh' });
                    break;
                  }
                  case 'inspectTraffic': {
                    const res = await fetch('/api/traffic?port=' + msg.port);
                    const data = await res.json();
                    window.postMessage({ type: 'trafficUpdate', traffic: data }, '*');
                    break;
                  }
                  case 'openBrowser': {
                    window.open(msg.url, '_blank');
                    break;
                  }
                  case 'copyUrl': {
                    navigator.clipboard.writeText(msg.url);
                    window.postMessage({ type: 'toast', message: 'Copied ' + msg.url, severity: 'info' }, '*');
                    break;
                  }
                  case 'setAutoRefresh': {
                    if (window.__refreshTimer) clearInterval(window.__refreshTimer);
                    if (msg.enabled && msg.interval > 0) {
                      window.__refreshTimer = setInterval(() => {
                        window.__superPortBackend.onMessage({ command: 'refresh' });
                      }, msg.interval);
                    }
                    break;
                  }
                }
              }
            };
            window.addEventListener('DOMContentLoaded', () => {
              window.__superPortBackend.onMessage({ command: 'refresh' });
              window.__superPortBackend.onMessage({ command: 'setAutoRefresh', enabled: true, interval: 3000 });
            });
          </script>
          `;
          const htmlStr = content.toString('utf8').replace('</body>', `${bridgeScript}</body>`);
          content = Buffer.from(htmlStr, 'utf8');
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });

    return new Promise((resolve, reject) => {
      server.listen(port, '127.0.0.1', () => {
        resolve(port);
      });
      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          // Retry on next port
          server.listen(port + 1, '127.0.0.1', () => {
            resolve(port + 1);
          });
        } else {
          reject(err);
        }
      });
    });
  }

  private parseJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body || '{}'));
        } catch {
          resolve({});
        }
      });
    });
  }

  public openBrowser(url: string): void {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      exec(`start ${url}`);
    } else if (process.platform === 'darwin') {
      exec(`open ${url}`);
    } else {
      exec(`xdg-open ${url}`);
    }
  }
}
