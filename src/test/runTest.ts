import { runFrameworkDetectorTests } from './framework-detector.test';
import { runCollisionSentinelTests } from './collision-sentinel.test';
import { runScannerAndKillerTests } from './port-scanner-and-killer.test';

async function main() {
  console.log('\n========================================');
  console.log('⚡ SUPER PORT TEST SUITE EXECUTION');
  console.log('========================================\n');

  try {
    runFrameworkDetectorTests();
    runCollisionSentinelTests();
    await runScannerAndKillerTests();

    console.log('\n========================================');
    console.log('🎉 ALL SUPER PORT TESTS PASSED! (3/3 suites)');
    console.log('========================================\n');
  } catch (err: any) {
    console.error('\n❌ Test failure encountered:');
    console.error(err);
    process.exit(1);
  }
}

main();
