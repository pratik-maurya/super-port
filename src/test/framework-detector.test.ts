import * as assert from 'assert';
import { detectFramework } from '../core/framework-detector';

export function runFrameworkDetectorTests() {
  console.log('  Testing Framework Detector...');

  // 1. Vite
  const vite1 = detectFramework({
    port: 5173,
    processName: 'node.exe',
    commandLine: 'node C:\\app\\node_modules\\vite\\bin\\vite.js',
    executablePath: 'C:\\Program Files\\nodejs\\node.exe'
  });
  assert.strictEqual(vite1.id, 'vite');
  assert.strictEqual(vite1.icon, '⚡');

  // 2. Next.js
  const next = detectFramework({
    port: 3000,
    processName: 'node.exe',
    commandLine: 'node C:\\app\\node_modules\\.bin\\next dev',
    executablePath: 'C:\\Program Files\\nodejs\\node.exe'
  });
  assert.strictEqual(next.id, 'nextjs');

  // 3. Angular CLI
  const angular = detectFramework({
    port: 4200,
    processName: 'node.exe',
    commandLine: 'ng serve --open',
    executablePath: 'C:\\Program Files\\nodejs\\node.exe'
  });
  assert.strictEqual(angular.id, 'angular');
  assert.strictEqual(angular.icon, '🅰️');

  // 4. FastAPI / Uvicorn
  const fastapi = detectFramework({
    port: 8000,
    processName: 'python.exe',
    commandLine: 'python -m uvicorn main:app --reload',
    executablePath: 'C:\\Python311\\python.exe'
  });
  assert.strictEqual(fastapi.id, 'fastapi');

  // 5. Docker
  const docker = detectFramework({
    port: 8080,
    processName: 'com.docker.backend.exe',
    commandLine: 'docker-proxy -proto tcp -host-ip 0.0.0.0 -host-port 8080',
    executablePath: ''
  });
  assert.strictEqual(docker.id, 'docker');
  assert.strictEqual(docker.icon, '🐳');

  // 6. PostgreSQL Database
  const pg = detectFramework({
    port: 5432,
    processName: 'postgres.exe',
    commandLine: 'postgres.exe -D /data',
    executablePath: ''
  });
  assert.strictEqual(pg.id, 'postgresql');
  assert.strictEqual(pg.category, 'database');

  // 7. Windows System Service
  const sys = detectFramework({
    port: 135,
    processName: 'svchost.exe',
    commandLine: 'svchost.exe -k RPCSS',
    executablePath: 'C:\\Windows\\System32\\svchost.exe'
  });
  assert.strictEqual(sys.category, 'system');

  console.log('  ✔ Framework Detector tests passed successfully.');
}
