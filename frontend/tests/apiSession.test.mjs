import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const output = await build({
  absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
  entryPoints: ['src/lib/api.ts'], bundle: true, write: false,
  platform: 'node', format: 'esm', define: { 'import.meta.env': '{}' },
});
const { apiCall, listRiskTreatmentPlans, getRiskTreatmentSummary } = await import(`data:text/javascript,${encodeURIComponent(output.outputFiles[0].text)}`);

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

test('treatment read failures reject instead of becoming successful empty data', async () => {
  const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window };
  globalThis.localStorage = { getItem: key => key === 'workspaceId' ? 'test-workspace' : null };
  globalThis.window = { location: { pathname: '/risks' } };
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'Treatment service unavailable' } }), { status: 503 });
    await assert.rejects(listRiskTreatmentPlans(), /Treatment service unavailable/);
    await assert.rejects(getRiskTreatmentSummary(), /Treatment service unavailable/);
    globalThis.fetch = async () => new Response(JSON.stringify({ data: [], error: null }), { status: 200 });
    assert.deepEqual(await listRiskTreatmentPlans(), []);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

test('overlapping workspace reads retain their captured workspace headers', async () => {
  const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage, window: globalThis.window };
  const storage = new Map([['authToken', 'session'], ['workspaceId', 'workspace-a']]);
  const pending = [];
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null };
  globalThis.window = { location: { pathname: '/risks' } };
  try {
    globalThis.fetch = (_url, options) => new Promise(resolve => {
      pending.push({ workspace: options.headers.get('X-Workspace-Id'), resolve });
    });
    const first = listRiskTreatmentPlans();
    storage.set('workspaceId', 'workspace-b');
    const second = listRiskTreatmentPlans();
    assert.deepEqual(pending.map(request => request.workspace), ['workspace-a', 'workspace-b']);
    pending[1].resolve(new Response(JSON.stringify({ data: [{ id: 'plan-b' }] }), { status: 200 }));
    assert.deepEqual(await second, [{ id: 'plan-b' }]);
    pending[0].resolve(new Response(JSON.stringify({ data: [{ id: 'plan-a' }] }), { status: 200 }));
    assert.deepEqual(await first, [{ id: 'plan-a' }]);
    assert.equal(storage.get('workspaceId'), 'workspace-b');
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});

test('shell summary distinguishes failed sources from successful empty sources', async () => {
  const bundle = await build({
    absWorkingDir: fileURLToPath(new URL('../', import.meta.url)),
    entryPoints: ['src/services/dashboard/shellSummary.ts'], bundle: true, write: false,
    alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) },
    platform: 'node', format: 'esm', define: { 'import.meta.env': '{}' },
  });
  const { fetchDashboardShellSummary } = await import(`data:text/javascript,${encodeURIComponent(bundle.outputFiles[0].text)}`);
  const original = { fetch: globalThis.fetch, localStorage: globalThis.localStorage };
  globalThis.localStorage = { getItem: () => 'local-test' };
  let fail = true;
  globalThis.fetch = async url => {
    if (fail && ['/api/v1/risks', '/api/v1/audit-readiness/summary'].includes(String(url))) {
      return new Response('{}', { status: 503 });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };
  try {
    const partial = await fetchDashboardShellSummary();
    assert.deepEqual(partial.sourceAvailability, { risks: false, audits: false, complete: false });
    fail = false;
    const empty = await fetchDashboardShellSummary();
    assert.deepEqual(empty.sourceAvailability, { risks: true, audits: true, complete: true });
    assert.equal(empty.counts.openRisks, 0);
    assert.equal(empty.counts.auditBlockers, 0);
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
});
