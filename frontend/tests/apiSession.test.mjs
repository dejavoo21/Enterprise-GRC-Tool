import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const output = await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['src/lib/api.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', define: { 'import.meta.env': '{}' },
});
const { apiCall } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);

test('401 from an old workspace session cannot clear a newer session', async () => {
  const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window };
  const storage = new Map([['authToken', 'old'], ['workspaceId', 'test-workspace']]);
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key) };
  globalThis.window = { location: { pathname: '/risks', href: '/risks' } };
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers.get('Authorization'), 'Bearer old');
      assert.equal(options.headers.get('X-Workspace-Id'), 'test-workspace');
      storage.set('authToken', 'new');
      return new Response(JSON.stringify({ error: { message: 'Expired session' } }), { status: 401 });
    };
    await assert.rejects(apiCall('http://localhost/test'), /Expired session/);
    assert.equal(storage.get('authToken'), 'new');
    assert.equal(window.location.href, '/risks');
    globalThis.fetch = async () => new Response('{}', { status: 401 });
    await assert.rejects(apiCall('http://localhost/test'), /401/);
    assert.equal(storage.has('authToken'), false);
    assert.equal(window.location.href, '/login');
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
