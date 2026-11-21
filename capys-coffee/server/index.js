import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { networkInterfaces } from 'node:os';
import { openDb, createStore } from './db.js';
import { createApp } from './app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const store = createStore(openDb(process.env.DB_FILE || join(root, 'data', 'capys.db')));
const { app } = createApp(store, { webDist: join(root, 'web', 'dist') });

const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => {
  const lan = Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  console.log(`\n  ☕  Capy's Coffee is running\n`);
  console.log(`  Customer menu   http://localhost:${port}/`);
  console.log(`  Staff           http://localhost:${port}/staff`);
  console.log(`  Pickup screen   http://localhost:${port}/display`);
  if (lan) console.log(`  On this Wi-Fi   http://${lan}:${port}/`);
  if (!process.env.STAFF_PIN && store.checkPin('1234')) console.log(`\n  Staff PIN is still the default 1234 — change it in Staff → Settings.`);
  console.log('');
});
