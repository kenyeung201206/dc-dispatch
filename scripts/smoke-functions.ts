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
// A reader's browser: the visit counter (functions/_middleware.ts) runs and sets its visit cookie.
const browser = { accept: 'text/html', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' };
const home = await fetch(`${base}/en/`, { headers: browser, redirect: 'manual' });
if (home.status !== 200) fail(`/en/ answered ${home.status} (the public site should open without a password)`);
if (!(home.headers.get('set-cookie') ?? '').startsWith('dcd_visit=1')) fail('the visit counter did not run on /en/');
const views = (await (await fetch(`${base}/api/views`)).json().catch(() => ({}))) as { status?: string; total?: number };
if (views.status !== 'ok') fail(`/api/views answered ${JSON.stringify(views)}`);
// Google Search Console ownership file: must answer at this exact address, without a redirect.
const google = await fetch(`${base}/google8ddb948929cb670a.html`, { redirect: 'manual' });
if (google.status !== 200 || (await google.text()) !== 'google-site-verification: google8ddb948929cb670a.html')
  fail(`/google8ddb948929cb670a.html answered ${google.status} (Google verification would fail)`);

const res = await fetch(`${base}/api/loot`, { redirect: 'manual' });
const body = (await res.json().catch(() => ({}))) as { status?: string; date?: string; reason?: string };
if (res.status === 200 && (body.status === 'ok' || body.status === 'none')) {
  console.log(`OK: site opens without a password; visit counter works; /api/loot works on Cloudflare's runtime (${body.status} ${body.date ?? ''}).`);
} else if (res.status === 502 && (!body.reason || /fetch failed|network|timed? ?out|abort/i.test(body.reason))) {
  // ProtoTrack itself down or unreachable from here: not a bug in our code.
  console.warn(`WARN: /api/loot couldn't reach ProtoTrack (${body.reason ?? 'HTTP error'}); the code itself ran fine.`);
} else {
  fail(`/api/loot answered ${res.status} ${JSON.stringify(body)}`);
}
// Banner server-status badge (巴哈 maintenance announcements).
const srv = await fetch(`${base}/api/server-status`, { redirect: 'manual' });
const sb = (await srv.json().catch(() => ({}))) as { state?: string; reason?: string };
if (srv.status !== 200 || !['normal', 'scheduled', 'maintenance', 'unknown'].includes(sb.state ?? '')) fail(`/api/server-status answered ${srv.status} ${JSON.stringify(sb)}`);
else if (sb.state === 'unknown' && !/fetch failed|network|timed? ?out|abort|HTTP \d|巴哈 refused/i.test(sb.reason ?? '')) fail(`/api/server-status crashed on Cloudflare: ${sb.reason}`);
else console.log(`OK: /api/server-status works on Cloudflare's runtime (${sb.state}${sb.reason ? ': ' + sb.reason : ''}).`);
clearTimeout(timer);
stop();
process.exit(0);
