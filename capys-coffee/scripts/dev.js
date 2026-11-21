// Runs the API server (with --watch) and the Vite dev server together.
import { spawn } from 'node:child_process';

const procs = [
  spawn(process.execPath, ['--disable-warning=ExperimentalWarning', '--watch-path=server', 'server/index.js'], { stdio: 'inherit', env: { ...process.env, PORT: '3000' } }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' }),
];
const stop = () => { for (const p of procs) p.kill(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const p of procs) p.on('exit', (code) => { if (code) stop(); });
