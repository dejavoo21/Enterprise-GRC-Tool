const http = require('http');

// First login to get token
function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'admin@example.com', password: 'Password123!' });
    const req = http.request({
      hostname: 'localhost', port: 3001, path: '/api/v1/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body).data.token));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function request(path, token) {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 3001, path,
      headers: { 'X-Workspace-Id': 'demo-workspace', 'Authorization': `Bearer ${token}` }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(`\n${path}:`);
        console.log(`  Status: ${res.statusCode}`);
        const data = JSON.parse(body);
        console.log(`  Array: ${Array.isArray(data.data)}`);
        console.log(`  Length: ${data.data?.length}`);
        if (data.error) console.log(`  Error: ${data.error.message}`);
        resolve();
      });
    });
    req.on('error', e => { console.log(`Error: ${e.message}`); resolve(); });
    req.end();
  });
}

async function main() {
  const token = await login();
  console.log('Token obtained');

  await request('/api/v1/training/awareness-campaigns', token);
  await request('/api/v1/training-practice/engagements', token);
  await request('/api/v1/training-practice/awareness-library', token);
  await request('/api/v1/training-practice/kpi-summaries', token);
  await request('/api/v1/reports/board/overview', token);
}

main().catch(console.error);
