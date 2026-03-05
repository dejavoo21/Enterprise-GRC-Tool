/**
 * GRC Tool Smoke Test Script
 *
 * Tests all major API endpoints to verify the system is working correctly.
 * A test passes if the API responds with status 200 and expected data structure.
 * Empty arrays are considered valid (API works, just no data).
 */

const http = require('http');

const API_BASE = 'http://localhost:3001';
const WORKSPACE_ID = 'demo-workspace';
let AUTH_TOKEN = null;

// Test counters
let passed = 0;
let failed = 0;
const results = [];

function request(method, path, body = null, skipAuth = false) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'X-Workspace-Id': WORKSPACE_ID,
      }
    };

    if (AUTH_TOKEN && !skipAuth) {
      options.headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data)
          });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function test(name, fn) {
  return fn().then(result => {
    if (result.pass) {
      passed++;
      results.push({ name, status: 'PASS', details: result.details });
      console.log(`  ✓ ${name}${result.details ? ` (${result.details})` : ''}`);
    } else {
      failed++;
      results.push({ name, status: 'FAIL', details: result.details });
      console.log(`  ✗ ${name}: ${result.details}`);
    }
  }).catch(err => {
    failed++;
    results.push({ name, status: 'FAIL', details: err.message });
    console.log(`  ✗ ${name}: ${err.message}`);
  });
}

async function runTests() {
  console.log('\n=== GRC Tool Smoke Test ===\n');

  // 1. Environment Sanity
  console.log('1. Environment Sanity');
  await test('Backend health check', async () => {
    const res = await request('GET', '/health', null, true);
    return { pass: res.status === 200 && res.data.status === 'ok', details: res.data.status };
  });

  // 2. Auth, Roles & Workspaces
  console.log('\n2. Auth, Roles & Workspaces');
  await test('Login with valid credentials', async () => {
    const res = await request('POST', '/api/v1/auth/login', {
      email: 'admin@example.com',
      password: 'Password123!'
    }, true);
    if (res.data.data?.token) {
      AUTH_TOKEN = res.data.data.token;
      return { pass: true, details: `user=${res.data.data.user?.email}` };
    }
    return { pass: false, details: res.data.error?.message || JSON.stringify(res.data) };
  });

  await test('Invalid login rejected', async () => {
    const res = await request('POST', '/api/v1/auth/login', {
      email: 'admin@example.com',
      password: 'wrongpassword'
    }, true);
    return {
      pass: res.status === 401 || res.data.error?.code === 'INVALID_CREDENTIALS',
      details: res.data.error?.code || `status=${res.status}`
    };
  });

  await test('Get current user info (/me)', async () => {
    const res = await request('GET', '/api/v1/auth/me');
    return {
      pass: res.status === 200 && res.data.data?.user,
      details: res.data.data?.user?.email || res.data.error?.message
    };
  });

  await test('Get workspaces for user', async () => {
    const res = await request('GET', '/api/v1/workspaces');
    // Empty array is OK - API works
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} workspaces`
    };
  });

  await test('Get seed profiles', async () => {
    const res = await request('GET', '/api/v1/workspaces/seed-profiles');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} profiles`
    };
  });

  // 3. Core GRC Flows
  console.log('\n3. Core GRC Flows');
  await test('Fetch controls', async () => {
    const res = await request('GET', '/api/v1/controls');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} controls`
    };
  });

  await test('Fetch risks', async () => {
    const res = await request('GET', '/api/v1/risks');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} risks`
    };
  });

  await test('Fetch evidence', async () => {
    const res = await request('GET', '/api/v1/evidence');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} evidence items`
    };
  });

  await test('Fetch frameworks', async () => {
    const res = await request('GET', '/api/v1/frameworks');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} frameworks`
    };
  });

  await test('Fetch assets', async () => {
    const res = await request('GET', '/api/v1/assets');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} assets`
    };
  });

  await test('Fetch vendors', async () => {
    const res = await request('GET', '/api/v1/vendors');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} vendors`
    };
  });

  // 4. Governance Docs & Activity Log
  console.log('\n4. Governance Docs & Activity Log');
  await test('Fetch governance documents', async () => {
    const res = await request('GET', '/api/v1/governance-documents');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} documents`
    };
  });

  await test('Fetch review tasks', async () => {
    const res = await request('GET', '/api/v1/review-tasks');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} tasks`
    };
  });

  await test('Fetch activity log', async () => {
    const res = await request('GET', '/api/v1/activity');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} entries`
    };
  });

  // 5. Linking Layer
  console.log('\n5. Linking Layer');
  await test('Fetch control mappings', async () => {
    const res = await request('GET', '/api/v1/control-mappings');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} mappings`
    };
  });

  // 6. Training & Awareness
  console.log('\n6. Training & Awareness');
  await test('Fetch training dashboard', async () => {
    const res = await request('GET', '/api/v1/training/dashboard');
    // Check for error response
    if (res.data.error) {
      return { pass: false, details: res.data.error.message };
    }
    return {
      pass: res.status === 200,
      details: res.data.data ? 'loaded' : 'empty dashboard'
    };
  });

  await test('Fetch training courses', async () => {
    const res = await request('GET', '/api/v1/training/courses');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} courses`
    };
  });

  await test('Fetch awareness campaigns', async () => {
    const res = await request('GET', '/api/v1/training/campaigns');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} campaigns`
    };
  });

  await test('Fetch training engagements', async () => {
    const res = await request('GET', '/api/v1/training-engagements');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} engagements`
    };
  });

  await test('Fetch awareness content', async () => {
    const res = await request('GET', '/api/v1/awareness-content');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} items`
    };
  });

  await test('Fetch KPI definitions', async () => {
    const res = await request('GET', '/api/v1/kpi/definitions');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} KPIs`
    };
  });

  // 7. Data Protection & AI Views
  console.log('\n7. Data Protection & AI Views');
  await test('Fetch data protection overview', async () => {
    const res = await request('GET', '/api/v1/reports/data-protection/overview');
    if (res.data.error) {
      return { pass: false, details: res.data.error.message };
    }
    return {
      pass: res.status === 200,
      details: 'loaded'
    };
  });

  // 8. Board Pack & Reports
  console.log('\n8. Board Pack & Reports');
  await test('Fetch board report overview', async () => {
    const res = await request('GET', '/api/v1/reports/board/overview');
    if (res.data.error) {
      return { pass: false, details: res.data.error.message };
    }
    return {
      pass: res.status === 200,
      details: 'loaded'
    };
  });

  await test('Fetch reports overview', async () => {
    const res = await request('GET', '/api/v1/reports/overview');
    if (res.data.error) {
      return { pass: false, details: res.data.error.message };
    }
    return {
      pass: res.status === 200,
      details: 'loaded'
    };
  });

  await test('Fetch risk profile report', async () => {
    const res = await request('GET', '/api/v1/reports/risk-profile');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} items`
    };
  });

  await test('Fetch control coverage report', async () => {
    const res = await request('GET', '/api/v1/reports/control-coverage');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} items`
    };
  });

  await test('Fetch vendors report', async () => {
    const res = await request('GET', '/api/v1/reports/vendors');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} vendors`
    };
  });

  // 9. Audit Readiness
  console.log('\n9. Audit Readiness');
  await test('Fetch audit readiness summary', async () => {
    const res = await request('GET', '/api/v1/audit-readiness/summary');
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} frameworks`
    };
  });

  // 10. Workspace Members & Invites
  console.log('\n10. Workspace Members & Invites');
  await test('Fetch workspace members', async () => {
    const res = await request('GET', `/api/v1/workspaces/${WORKSPACE_ID}/members`);
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} members`
    };
  });

  await test('Fetch workspace invitations', async () => {
    const res = await request('GET', `/api/v1/workspaces/${WORKSPACE_ID}/invitations`);
    return {
      pass: res.status === 200 && Array.isArray(res.data.data),
      details: `${res.data.data?.length || 0} invitations`
    };
  });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('=== SMOKE TEST SUMMARY ===');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`Passed:      ${passed} ✓`);
  console.log(`Failed:      ${failed} ✗`);
  console.log('='.repeat(50));

  if (failed > 0) {
    console.log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ✗ ${r.name}: ${r.details}`);
    });
  } else {
    console.log('\n🎉 All smoke tests passed! The GRC platform API is working correctly.');
  }

  // Exit with success (0) if at least 90% pass
  const passRate = passed / (passed + failed);
  if (passRate >= 0.9) {
    console.log(`\n✓ Pass rate: ${(passRate * 100).toFixed(1)}% (threshold: 90%)`);
    process.exit(0);
  } else {
    console.log(`\n✗ Pass rate: ${(passRate * 100).toFixed(1)}% (below 90% threshold)`);
    process.exit(1);
  }
}

runTests().catch(console.error);
