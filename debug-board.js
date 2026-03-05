const http = require('http');

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

async function main() {
  const token = await login();

  const req = http.request({
    hostname: 'localhost', port: 3001, path: '/api/v1/reports/board/overview',
    headers: {
      'X-Workspace-Id': 'demo-workspace',
      'Authorization': `Bearer ${token}`
    }
  }, res => {
    let body = '';
    res.on('data', c => body += c);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Body:', body);
    });
  });
  req.on('error', e => console.log('Error:', e.message));
  req.end();
}

main().catch(console.error);
