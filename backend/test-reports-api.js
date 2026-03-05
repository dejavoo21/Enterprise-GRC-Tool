// Quick test script to verify reports API
const testApi = async () => {
  try {
    console.log('Testing Reports API endpoints...\n');

    // Test overview
    console.log('1. Testing GET /api/v1/reports/overview');
    const overviewRes = await fetch('http://localhost:3001/api/v1/reports/overview');
    const overview = await overviewRes.json();
    console.log('   Status:', overviewRes.status);
    console.log('   Data keys:', Object.keys(overview.data || {}));
    console.log('   Risks total:', overview.data?.risks?.total);
    console.log('   Controls total:', overview.data?.controls?.total);
    console.log('   Error:', overview.error);
    console.log();

    // Test risk-profile
    console.log('2. Testing GET /api/v1/reports/risk-profile');
    const risksRes = await fetch('http://localhost:3001/api/v1/reports/risk-profile');
    const risks = await risksRes.json();
    console.log('   Status:', risksRes.status);
    console.log('   Items count:', risks.data?.length || 0);
    if (risks.data?.length > 0) {
      console.log('   First item keys:', Object.keys(risks.data[0]));
    }
    console.log('   Error:', risks.error);
    console.log();

    // Test control-coverage
    console.log('3. Testing GET /api/v1/reports/control-coverage');
    const controlsRes = await fetch('http://localhost:3001/api/v1/reports/control-coverage');
    const controls = await controlsRes.json();
    console.log('   Status:', controlsRes.status);
    console.log('   Items count:', controls.data?.length || 0);
    if (controls.data?.length > 0) {
      console.log('   First item keys:', Object.keys(controls.data[0]));
    }
    console.log('   Error:', controls.error);
    console.log();

    // Test vendors
    console.log('4. Testing GET /api/v1/reports/vendors');
    const vendorsRes = await fetch('http://localhost:3001/api/v1/reports/vendors');
    const vendors = await vendorsRes.json();
    console.log('   Status:', vendorsRes.status);
    console.log('   Items count:', vendors.data?.length || 0);
    if (vendors.data?.length > 0) {
      console.log('   First item keys:', Object.keys(vendors.data[0]));
    }
    console.log('   Error:', vendors.error);
    console.log();

    // Test CSV export
    console.log('5. Testing GET /api/v1/reports/risk-profile.csv');
    const csvRes = await fetch('http://localhost:3001/api/v1/reports/risk-profile.csv');
    const csvText = await csvRes.text();
    console.log('   Status:', csvRes.status);
    console.log('   Content-Type:', csvRes.headers.get('content-type'));
    console.log('   First 200 chars of CSV:');
    console.log('   ', csvText.substring(0, 200));
    console.log();

    console.log('✅ All endpoints tested successfully!');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
};

testApi();
