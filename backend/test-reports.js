#!/usr/bin/env node
const http = require('http');

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing GRC Reports API Endpoints\n');
  console.log('='.repeat(60));

  const tests = [
    { name: 'GET /api/v1/reports/overview', path: '/api/v1/reports/overview' },
    { name: 'GET /api/v1/reports/risk-profile', path: '/api/v1/reports/risk-profile' },
    { name: 'GET /api/v1/reports/control-coverage', path: '/api/v1/reports/control-coverage' },
    { name: 'GET /api/v1/reports/vendors', path: '/api/v1/reports/vendors' },
    { name: 'GET /api/v1/reports/risk-profile.csv', path: '/api/v1/reports/risk-profile.csv' },
    { name: 'GET /api/v1/reports/control-coverage.csv', path: '/api/v1/reports/control-coverage.csv' },
    { name: 'GET /api/v1/reports/vendors.csv', path: '/api/v1/reports/vendors.csv' },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`\n📝 ${test.name}`);
      const result = await makeRequest(test.path);

      if (result.status === 200) {
        console.log(`   ✅ Status: ${result.status}`);

        if (test.name.includes('.csv')) {
          const lines = result.body.split('\n');
          console.log(`   ✅ Content-Type: ${result.headers['content-type']}`);
          console.log(`   ✅ Lines: ${lines.length - 1} (+ header)`);
          console.log(`   📋 Header: ${lines[0].substring(0, 80)}...`);
          console.log(`   📋 First row: ${lines[1]?.substring(0, 80)}...`);
        } else {
          const json = JSON.parse(result.body);
          console.log(`   ✅ Content-Type: ${result.headers['content-type']}`);

          if (json.error) {
            console.log(`   ❌ Error in response: ${json.error}`);
            failed++;
          } else if (json.data) {
            if (Array.isArray(json.data)) {
              console.log(`   ✅ Data is array: ${json.data.length} items`);
              if (json.data.length > 0) {
                console.log(`   ✅ First item keys: ${Object.keys(json.data[0]).join(', ')}`);
              }
            } else {
              console.log(`   ✅ Data is object`);
              console.log(`   ✅ Keys: ${Object.keys(json.data).join(', ')}`);
            }
            passed++;
          } else {
            console.log(`   ❌ No data in response`);
            failed++;
          }
        }
      } else {
        console.log(`   ❌ Status: ${result.status}`);
        failed++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message || JSON.stringify(err)}`);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
}

runTests().catch(console.error);
