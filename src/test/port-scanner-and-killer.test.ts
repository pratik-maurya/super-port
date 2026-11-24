import * as assert from 'assert';
import * as http from 'http';
import { PortScanner } from '../core/port-scanner';
import { ProcessKiller } from '../core/process-killer';
import { TrafficInspector } from '../core/traffic-inspector';

export async function runScannerAndKillerTests() {
  console.log('  Testing Port Scanner & Process Killer integration...');

  const TEST_PORT = 34567;
  const scanner = new PortScanner();
  const killer = new ProcessKiller(scanner);
  const trafficInspector = new TrafficInspector(scanner);

  // 1. Verify protected system PIDs
  const protectedResult = await killer.killProcessTree(4, 'System', 445);
  assert.strictEqual(protectedResult.success, false);
  assert.strictEqual(protectedResult.error, 'PROTECTED_SYSTEM_PROCESS');

  // 2. Start a test server on TEST_PORT
  const testServer = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Super Port Test Server');
  });

  await new Promise<void>((resolve, reject) => {
    testServer.listen(TEST_PORT, '127.0.0.1', () => {
      resolve();
    });
    testServer.on('error', reject);
  });

  try {
    // 3. Scan ports
    const ports = await scanner.scanListeningPorts({ includeSystemPorts: true });
    const detected = ports.find(p => p.port === TEST_PORT);

    assert.ok(detected !== undefined, `Port ${TEST_PORT} should be detected by PortScanner`);
    assert.strictEqual(detected?.port, TEST_PORT);
    assert.strictEqual(detected?.pid, process.pid);
    assert.ok(detected?.processName.toLowerCase().includes('node'));
    assert.strictEqual(detected?.url, `http://localhost:${TEST_PORT}`);
    assert.ok(detected?.memoryFormatted.length > 0);

    // 4. Test Traffic Inspector
    const traffic = await trafficInspector.inspectPortTraffic(TEST_PORT);
    assert.strictEqual(traffic.port, TEST_PORT);
    assert.strictEqual(traffic.listeningPid, process.pid);

    console.log(`    Successfully detected test server on :${TEST_PORT} (PID ${detected?.pid}, ${detected?.memoryFormatted})`);
  } finally {
    // Clean up server
    await new Promise<void>(resolve => {
      testServer.close(() => resolve());
    });
  }

  // 5. Verify port is released after close
  await new Promise(r => setTimeout(r, 200));
  const postClosePorts = await scanner.scanListeningPorts({ includeSystemPorts: true });
  const stillThere = postClosePorts.some(p => p.port === TEST_PORT);
  assert.strictEqual(stillThere, false, `Port ${TEST_PORT} should be released after closing`);

  console.log('  ✔ Port Scanner & Process Killer tests passed successfully.');
}
