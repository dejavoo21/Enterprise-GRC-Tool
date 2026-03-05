#!/usr/bin/env node

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/assets',
  method: 'GET'
};

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
});

req.end();
