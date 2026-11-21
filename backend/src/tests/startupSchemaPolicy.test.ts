import assert from 'node:assert/strict';
import test from 'node:test';
import { runRuntimeSchemaBootstrap, shouldRunRuntimeSchemaBootstrap } from '../services/startupSchemaPolicy.js';

test('ordinary startup never opts into runtime DDL', async () => {
  let calls = 0;
  const ran = await runRuntimeSchemaBootstrap({}, [async () => { calls += 1; }]);
  assert.equal(ran, false);
  assert.equal(calls, 0);
});

test('production rejects runtime schema bootstrap even when requested', () => {
  assert.throws(
    () => shouldRunRuntimeSchemaBootstrap({ NODE_ENV: 'production', ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'true' }),
    /prohibited in production/,
  );
});

test('explicit non-production compatibility mode runs ordered bootstraps', async () => {
  const calls: number[] = [];
  const ran = await runRuntimeSchemaBootstrap(
    { NODE_ENV: 'development', ALLOW_RUNTIME_SCHEMA_BOOTSTRAP: 'true' },
    [async () => { calls.push(1); }, async () => { calls.push(2); }],
  );
  assert.equal(ran, true);
  assert.deepEqual(calls, [1, 2]);
});
