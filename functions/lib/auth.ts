/**
 * Password lock for the whole site (runs in a Cloudflare Pages Function, free plan).
 *
 * - SITE_PASSWORD: the shared password (Pages secret).
 * - AUTH_SECRET:   random key that signs the sign-in cookie (Pages secret).
 * Cookie = "v1.<expiry>.<HMAC(AUTH_SECRET, v1.<expiry>.<sha256(password)>)>", so it can't be forged,
 * and changing the password signs everyone out. Missing secrets ⇒ the site stays locked (fail closed).
 */

export interface AuthEnv {
  SITE_PASSWORD?: string;
  AUTH_SECRET?: string;
}

export const COOKIE = 'dcd_auth';
export const MAX_AGE_DAYS = 30;
export const LOGIN_PATH = '/__login';
export const LOGOUT_PATH = '/__logout';

const enc = new TextEncoder();
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(msg)));
}
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));

/** Constant-time string comparison (compares HMACs of both sides, so length leaks nothing useful). */
export async function safeEqual(a: string, b: string, secret: string): Promise<boolean> {
  const [x, y] = await Promise.all([hmac(secret, a), hmac(secret, b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0 && x.length === y.length;
}

export const configured = (env: AuthEnv) => Boolean(env.SITE_PASSWORD && env.AUTH_SECRET && env.AUTH_SECRET.length >= 16);

export async function makeToken(env: Required<AuthEnv>, nowMs: number): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + MAX_AGE_DAYS * 86_400;
  const body = `v1.${exp}`;
  return `${body}.${await hmac(env.AUTH_SECRET, `${body}.${await sha256(env.SITE_PASSWORD)}`)}`;
}

export async function verifyToken(env: Required<AuthEnv>, token: string | undefined, nowMs: number): Promise<boolean> {
  if (!token) return false;
  const m = token.match(/^v1\.(\d{1,12})\.([0-9a-f]{64})$/);
  if (!m) return false;
  if (Number(m[1]) * 1000 < nowMs) return false;
  const expected = await hmac(env.AUTH_SECRET, `v1.${m[1]}.${await sha256(env.SITE_PASSWORD)}`);
  return safeEqual(expected, m[2]!, env.AUTH_SECRET);
}

export function readCookie(header: string | null, name: string): string | undefined {
  for (const part of (header ?? '').split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return part.slice(i + 1);
  }
  return undefined;
}

export function cookieHeader(token: string, secure: boolean): string {
  return `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE_DAYS * 86_400}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
export const clearCookieHeader = (secure: boolean) => `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;

/** Only allow redirects back to our own paths ("/en/…"), never to another site ("//evil", "https:…"). */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\') || raw.startsWith(LOGIN_PATH)) return '/';
  return raw;
}

/** Best-effort brute-force brake, per IP, per server instance. */
const failures = new Map<string, { n: number; until: number }>();
export const MAX_FAILURES = 8;
export const LOCK_MS = 10 * 60_000;
export function isLockedOut(ip: string, now: number): boolean {
  const f = failures.get(ip);
  return Boolean(f && f.n >= MAX_FAILURES && f.until > now);
}
export function recordFailure(ip: string, now: number) {
  const f = failures.get(ip);
  const fresh = !f || f.until < now;
  failures.set(ip, { n: fresh ? 1 : f!.n + 1, until: now + LOCK_MS });
}
export const clearFailures = (ip: string) => failures.delete(ip);
export const _resetFailures = () => failures.clear();

const SECURITY_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export type LoginState = 'ask' | 'wrong' | 'locked' | 'unconfigured';

export function loginPage(state: LoginState, next: string, status = 200): Response {
  const msg: Record<LoginState, [string, string]> = {
    ask: ['', ''],
    wrong: ['Wrong password. Try again.', '密碼不正確，請再試一次。'],
    locked: ['Too many tries. Wait 10 minutes.', '嘗試次數過多，請等 10 分鐘後再試。'],
    unconfigured: ['The site lock is not set up yet, so the paper stays closed.', '網站密碼尚未設定，報紙暫不開放。'],
  };
  const [en, zh] = msg[state];
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><title>Sign in · The DC Dispatch</title>
<link rel="manifest" href="/manifest.webmanifest"><link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="DC Dispatch"><meta name="theme-color" content="#121416">
<style>
:root{color-scheme:light dark;--o:#ff6d10;--ink:#1b1a17;--paper:#f3eee3}
@media (prefers-color-scheme:dark){:root{--ink:#e8e4da;--paper:#121416}}
*{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;background:var(--paper);color:var(--ink);
font:17px/1.5 Georgia,"Noto Serif TC",serif;padding:16px}
main{width:100%;max-width:400px;border:2px solid var(--ink);padding:24px;position:relative}
main:before,main:after{content:"";position:absolute;width:16px;height:16px;border:3px solid var(--o)}
main:before{top:-3px;left:-3px;border-right:0;border-bottom:0}main:after{bottom:-3px;right:-3px;border-left:0;border-top:0}
h1{margin:0;font-size:1.9rem;line-height:1.1}.zh{margin:4px 0 16px;letter-spacing:.2em;font-weight:900}
label{display:block;font:600 .85rem ui-monospace,monospace;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
input{width:100%;min-height:48px;font-size:1rem;padding:8px 12px;border:2px solid var(--ink);background:transparent;color:inherit}
button{margin-top:12px;width:100%;min-height:48px;border:0;background:var(--o);color:#111;font:700 1rem ui-monospace,monospace;cursor:pointer}
input:focus-visible,button:focus-visible{outline:3px solid #0b57d0;outline-offset:2px}
.msg{color:#c62828;font-weight:700;margin:12px 0 0}.fine{font:.8rem ui-monospace,monospace;opacity:.75;margin-top:16px}
</style></head><body><main>
<h1>The DC Dispatch</h1><p class="zh" lang="zh-Hant-TW">華盛頓每日快報</p>
${
  state === 'unconfigured'
    ? ''
    : `<form method="post" action="${LOGIN_PATH}"><input type="hidden" name="next" value="${esc(next)}">
<label for="pw">Password · <span lang="zh-Hant-TW">密碼</span></label>
<input id="pw" name="password" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Sign in · <span lang="zh-Hant-TW">登入</span></button></form>`
}
${en ? `<p class="msg" role="alert">${en}<br><span lang="zh-Hant-TW">${zh}</span></p>` : ''}
<p class="fine">Private paper for two readers. You stay signed in for 30 days on this device.<br>
<span lang="zh-Hant-TW">私人報紙。此裝置會保持登入 30 天。</span></p>
</main></body></html>`;
  return new Response(html, { status, headers: SECURITY_HEADERS });
}
