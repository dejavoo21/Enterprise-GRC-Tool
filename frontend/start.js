#!/usr/bin/env node
const { execSync } = require('child_process');

const port = process.env.PORT || 3000;
console.log(`Starting server on port ${port}`);

execSync(`npx serve -s dist -l ${port}`, {
  stdio: 'inherit',
  env: { ...process.env }
});
