// Runs the built site with its server code (functions/) on Cloudflare's own runtime (wrangler pages dev), the
// same way the live site runs, and checks the parts that only run there:
// - the site opens without any password (it is public);
// - /api/loot (the live 戰鬥升級 list) answers instead of crashing.
// Unit tests run under Node, which accepts things Cloudflare rejects (2026-11-10: `redirect: 'error'` crashed
// /api/loot on every visit, and the box never switched to the new day).
// Usage (after `pnpm run build`): node scripts/smoke-functions.ts
import { spawn, spawnSync } from 'node:child_process';

// A random port each run, so a leftover server from an earlier run can never answer instead.
const PORT = 20000 + Math.floor(Math.random() * 20000);
const base = `http://127.0.0.1:${PORT}`;
const args = ['exec', 'wrangler', 'pages', 'dev', 'dist', '--port', String(PORT), '--ip', '127.0.0.1'];
const server = spawn('pnpm', args, { shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
let output = '';
server.stdout.on('data', (d) => (output += d));
server.stderr.on('data', (d) => (output += d));

const stop = () => {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    else process.kill(-server.pid!, 'SIGTERM');
  } catch {}
};
const fail = (msg: string) => {
  console.error(`SMOKE FAILED: ${msg}`);
  stop();
  process.exit(1);
};

async function waitReady() {
  for (let i = 0; i < 120; i++) {
    try {
      await fetch(base, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  fail(`server never started:\n${output.slice(-2000)}`);
}

await waitReady();
const timer = setTimeout(() => fail('no answer within 60 s'), 60_000);
const home = await fetch(`${base}/en/`, { redirect: 'manual' });
if (home.status !== 200) fail(`/en/ answered ${home.status} (the public site should open without a password)`);

const res = await fetch(`${base}/api/loot`, { redirect: 'manual' });
const body = (await res.json().catch(() => ({}))) as { status?: string; date?: string; reason?: string };
if (res.status === 200 && (body.status === 'ok' || body.status === 'none')) {
  console.log(`OK: site opens without a password; /api/loot works on Cloudflare's runtime (${body.status} ${body.date ?? ''}).`);
} else if (res.status === 502 && (!body.reason || /fetch failed|network|timed? ?out|abort/i.test(body.reason))) {
  // ProtoTrack itself down or unreachable from here: not a bug in our code.
  console.warn(`WARN: /api/loot couldn't reach ProtoTrack (${body.reason ?? 'HTTP error'}); the code itself ran fine.`);
} else {
  fail(`/api/loot answered ${res.status} ${JSON.stringify(body)}`);
}
clearTimeout(timer);
stop();
process.exit(0);
