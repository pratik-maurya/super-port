import * as assert from 'assert';
import { CollisionSentinel } from '../core/collision-sentinel';

export function runCollisionSentinelTests() {
  console.log('  Testing Collision Sentinel...');

  // 1. Vite / Node EADDRINUSE :::3000
  const match1 = CollisionSentinel.detectCollision(
    'Error: listen EADDRINUSE: address already in use :::3000\n    at Server.setupListenHandle'
  );
  assert.ok(match1 !== null);
  assert.strictEqual(match1?.port, 3000);

  // 2. 0.0.0.0:4200
  const match2 = CollisionSentinel.detectCollision(
    'Error: listen EADDRINUSE: address already in use 0.0.0.0:4200'
  );
  assert.ok(match2 !== null);
  assert.strictEqual(match2?.port, 4200);

  // 3. React CRA "Something is already running on port 3000"
  const match3 = CollisionSentinel.detectCollision(
    'Something is already running on port 8080. Would you like to run the app on another port instead?'
  );
  assert.ok(match3 !== null);
  assert.strictEqual(match3?.port, 8080);

  // 4. Python address already in use
  const match4 = CollisionSentinel.detectCollision(
    'OSError: [Errno 98] address already in use: 127.0.0.1:5000'
  );
  assert.ok(match4 !== null);
  assert.strictEqual(match4?.port, 5000);

  // 5. Non-matching regular output
  const match5 = CollisionSentinel.detectCollision(
    'Server listening on http://localhost:3000'
  );
  assert.strictEqual(match5, null);

  console.log('  ✔ Collision Sentinel tests passed successfully.');
}
