#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Starting production build...\n');

// Start the API server
const api = spawn('node', ['dist/server/src/index.js'], {
  cwd: join(__dirname, 'server'),
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

// Start the frontend server
const frontend = spawn('node', ['.output/server/index.mjs'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', PORT: '8080' }
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down...');
  api.kill();
  frontend.kill();
  process.exit(0);
});

api.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ API server exited with code ${code}`);
    frontend.kill();
    process.exit(code);
  }
});

frontend.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ Frontend server exited with code ${code}`);
    api.kill();
    process.exit(code);
  }
});

console.log('✅ Production servers started!');
console.log('📱 Frontend: http://localhost:8080');
console.log('🔌 API: http://localhost:3001');
