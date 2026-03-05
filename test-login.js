// Simple test script for login
const http = require('http');

const data = JSON.stringify({
  email: 'admin@example.com',
  password: 'Password123!'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const parsed = JSON.parse(body);
    if (parsed.data && parsed.data.token) {
      console.log('TOKEN:', parsed.data.token);
      console.log('USER:', parsed.data.user);
      console.log('WORKSPACE:', parsed.data.workspaceId);
    } else {
      console.log('Response:', body);
    }
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
