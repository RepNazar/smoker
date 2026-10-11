'use strict';

if (process.platform === 'win32') {
  const { spawn } = require('node:child_process');
  const path = require('node:path');
  const launcher = spawn('powershell.exe', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass',
    '-File', path.join(__dirname, 'start-local.ps1'),
  ], { stdio: 'inherit' });
  launcher.on('error', error => {
    console.error('Local launch failed:', error.message);
    process.exitCode = 1;
  });
  launcher.on('exit', code => { process.exitCode = code ?? 1; });
} else {
  require('./server.js');
}
