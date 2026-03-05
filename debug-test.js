const http = require('http');

function request(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3001');
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      headers: {
        'X-Workspace-Id': 'demo-workspace',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`\n${path}:`);
        console.log(`  Status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          console.log(`  Data type: ${Array.isArray(parsed.data) ? 'array' : typeof parsed.data}`);
          console.log(`  Data length: ${Array.isArray(parsed.data) ? parsed.data.length : 'N/A'}`);
          if (parsed.error) console.log(`  Error: ${parsed.error.message}`);
        } catch (e) {
          console.log(`  Parse error: ${e.message}`);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function test() {
  await request('/api/v1/training/awareness-campaigns');
  await request('/api/v1/training-practice/engagements');
  await request('/api/v1/training-practice/awareness-library');
  await request('/api/v1/training-practice/kpi-summaries');
  await request('/api/v1/reports/board/overview');
}

test().catch(console.error);
