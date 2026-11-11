/**
 * Visitor number for the masthead, from Cloudflare Web Analytics (free, no limit on visits).
 * Each robot run asks Cloudflare for the last 3 days of visits, hour by hour, and saves a running daily
 * count in data/visits.json; the site shows total + today from that file (so it's up to 2 hours behind).
 * Needs three GitHub secrets: CF_ANALYTICS_TOKEN (read-only "Account Analytics" token),
 * CLOUDFLARE_ACCOUNT_ID (already set for deploys) and CF_WEB_ANALYTICS_SITE_TAG. Without them it does nothing.
 * Only counts are stored: no pages, no countries, nothing about any one visitor.
 */
import { assertAllowedUrl } from './http.ts';
import { TIMEZONE, USER_AGENT } from './config.ts';
import type { Visits } from '../src/schema/item.ts';

export const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const LOOKBACK_DAYS = 3;

export interface VisitsEnv {
  CF_ANALYTICS_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CF_WEB_ANALYTICS_SITE_TAG?: string;
}
export interface HourRow {
  /** Start of the hour, UTC ISO time. */
  hour: string;
  visits: number;
}

const QUERY = `query Visits($accountTag: string!, $siteTag: string!, $since: Time!, $until: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      rumPageloadEventsAdaptiveGroups(
        filter: { AND: [{ datetime_geq: $since, datetime_lt: $until }, { siteTag: $siteTag }] }
        limit: 1000
        orderBy: [datetimeHour_ASC]
      ) {
        sum { visits }
        dimensions { datetimeHour }
      }
    }
  }
}`;

/** Day in the paper's time zone (Tokyo), YYYY-MM-DD. */
export const paperDay = (t: Date | number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));

/** Midnight (Tokyo) at the start of the day `daysBack` days before `now`, as a Date. */
export function dayStart(now: Date, daysBack: number): Date {
  const day = paperDay(new Date(now.getTime() - daysBack * 86_400_000));
  return new Date(`${day}T00:00:00+09:00`);
}

export function parseVisitsResponse(json: unknown): HourRow[] {
  const j = json as {
    errors?: { message?: string }[] | null;
    data?: { viewer?: { accounts?: { rumPageloadEventsAdaptiveGroups?: { sum?: { visits?: number }; dimensions?: { datetimeHour?: string } }[] }[] } };
  };
  if (j.errors?.length) throw new Error(`Cloudflare analytics: ${j.errors.map((e) => e.message).join('; ').slice(0, 200)}`);
  const account = j.data?.viewer?.accounts?.[0];
  if (!account) throw new Error('Cloudflare analytics: no account in the answer (wrong account id or token?)');
  return (account.rumPageloadEventsAdaptiveGroups ?? [])
    .filter((g) => g.dimensions?.datetimeHour)
    .map((g) => ({ hour: new Date(g.dimensions!.datetimeHour!).toISOString(), visits: Math.max(0, Math.round(g.sum?.visits ?? 0)) }));
}

/**
 * New daily counts: every Tokyo day from `since` onwards is replaced by what Cloudflare reported (so a day that
 * was half-counted on the last run gets corrected); older days are kept as they were.
 */
export function mergeVisits(prev: Visits, rows: HourRow[], since: Date, now: Date): Visits {
  const firstDay = paperDay(since);
  const days: Record<string, number> = {};
  for (const [d, n] of Object.entries(prev.days)) if (d < firstDay) days[d] = n;
  for (let d = firstDay; d <= paperDay(now); d = paperDay(new Date(`${d}T12:00:00+09:00`).getTime() + 86_400_000)) days[d] = 0;
  for (const r of rows) {
    const d = paperDay(new Date(r.hour));
    if (d >= firstDay) days[d] = (days[d] ?? 0) + r.visits;
  }
  return { ...prev, updatedAt: now.toISOString(), days };
}

export const totalVisits = (v: Visits) => v.carriedOver + Object.values(v.days).reduce((a, b) => a + b, 0);

export async function fetchVisits(env: Required<VisitsEnv>, since: Date, until: Date, f: typeof fetch = fetch): Promise<HourRow[]> {
  const url = assertAllowedUrl(GRAPHQL_URL);
  const res = await f(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`, 'content-type': 'application/json', 'user-agent': USER_AGENT },
    body: JSON.stringify({
      query: QUERY,
      variables: { accountTag: env.CLOUDFLARE_ACCOUNT_ID, siteTag: env.CF_WEB_ANALYTICS_SITE_TAG, since: since.toISOString(), until: until.toISOString() },
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Cloudflare analytics HTTP ${res.status}`);
  return parseVisitsResponse(await res.json());
}

/** One robot run: returns the updated counts, or undefined when the secrets aren't set (nothing to do). */
export async function updateVisits(prev: Visits, env: VisitsEnv, now: Date, f: typeof fetch = fetch): Promise<Visits | undefined> {
  if (!env.CF_ANALYTICS_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID || !env.CF_WEB_ANALYTICS_SITE_TAG) return undefined;
  const since = dayStart(now, LOOKBACK_DAYS - 1);
  const rows = await fetchVisits(env as Required<VisitsEnv>, since, now, f);
  return mergeVisits(prev, rows, since, now);
}
