#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Support both compiled out/cli/cli.js and ts-node if developing
let cliPath = path.resolve(__dirname, '..', 'out', 'cli', 'cli.js');

if (!fs.existsSync(cliPath)) {
  // If not compiled yet, try compiling or notify
  try {
    require('child_process').execSync('npm run compile', {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'inherit'
    });
  } catch (e) {
    console.error('Failed to compile Super Port TypeScript files. Please run npm run compile.');
    process.exit(1);
  }
}

const { runCli } = require(cliPath);
const args = process.argv.slice(2);

runCli(args).catch(err => {
  console.error('Super Port CLI Error:', err);
  process.exit(1);
});
