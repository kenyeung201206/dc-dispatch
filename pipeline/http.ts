import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ALLOWED_HOSTS, USER_AGENT } from './config.ts';
import { log } from './log.ts';

const CACHE_DIR = 'data/cache/http';
const MAX_BYTES = 5 * 1024 * 1024;

interface CacheEntry {
  etag?: string;
  lastModified?: string;
  body: string;
}

export function assertAllowedUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:') throw new Error(`Refusing non-https URL: ${url.protocol}`);
  if (!ALLOWED_HOSTS.has(url.hostname)) throw new Error(`Refusing host not on allowlist: ${url.hostname}`);
  return url;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Polite GET: allowlisted https hosts only, timeout, retries with backoff,
 * conditional requests (ETag / Last-Modified) against a local cache, size cap.
 */
export async function politeGet(raw: string, { timeoutMs = 20_000, retries = 2 } = {}): Promise<string> {
  const url = assertAllowedUrl(raw);
  const key = createHash('sha256').update(url.href).digest('hex').slice(0, 24);
  const cachePath = join(CACHE_DIR, `${key}.json`);
  let cached: CacheEntry | undefined;
  try {
    cached = JSON.parse(await readFile(cachePath, 'utf8')) as CacheEntry;
  } catch {}

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: '*/*' };
      if (cached?.etag) headers['if-none-match'] = cached.etag;
      if (cached?.lastModified) headers['if-modified-since'] = cached.lastModified;
      const res = await fetch(url, { headers, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 304 && cached) {
        log('info', 'http not modified', { host: url.hostname });
        return cached.body;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const len = Number(res.headers.get('content-length') ?? 0);
      if (len > MAX_BYTES) throw new Error(`Response too large: ${len}`);
      const body = await res.text();
      if (body.length > MAX_BYTES) throw new Error('Response too large');
      await mkdir(CACHE_DIR, { recursive: true });
      const entry: CacheEntry = {
        etag: res.headers.get('etag') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
        body,
      };
      await writeFile(cachePath, JSON.stringify(entry));
      log('info', 'http ok', { host: url.hostname, bytes: body.length, attempt });
      return body;
    } catch (err) {
      lastErr = err;
      log('warn', 'http retry', { host: url.hostname, attempt, error: String(err) });
      if (attempt < retries) await sleep(1000 * 2 ** attempt);
    }
  }
  throw lastErr;
}
