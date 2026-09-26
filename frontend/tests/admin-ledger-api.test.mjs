import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const output = await build({ absWorkingDir: fileURLToPath(new URL('../', import.meta.url)), entryPoints: ['src/lib/api.ts'], bundle: true, write: false, platform: 'node', format: 'esm', define: { 'import.meta.env': '{}' } });
const { fetchActivityLedger, exportActivityLedger } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);
test('administration ledger and exports surface remote failures rather than successful empty evidence', async () => {
  const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window };
  globalThis.localStorage = { getItem: key => key === 'workspaceId' ? 'isolated-admin-test' : null };
  globalThis.window = { location: { pathname: '/activity-ledger' } };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Ledger unavailable' } }), { status: 503 });
    await assert.rejects(fetchActivityLedger({}, { requireRemote: true }), /Ledger unavailable/);
    await assert.rejects(exportActivityLedger({}, { requireRemote: true }), /Ledger unavailable/);
    assert.deepEqual((await fetchActivityLedger()).entries, []);
    assert.deepEqual((await exportActivityLedger()).entries, []);
  } finally { for (const [key,value] of Object.entries(original)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; } }
});
