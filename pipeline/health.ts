/**
 * Source health for the watchdog: each news source remembers since when it has been failing (fetch/parse error,
 * or nothing at all came back). One bad run is normal (a site hiccup); a source that stays bad for 6 hours
 * (~3 robot runs) gets the owner an email, then once a day while it lasts. See scripts/check-sources.ts.
 */
export interface SourceHealth {
  id: string;
  ok: boolean;
  items: number;
  note?: string;
  /** When this source first went bad (ISO time); absent while it's healthy. */
  failingSince?: string;
}

export function trackHealth(now: Date, current: Omit<SourceHealth, 'failingSince'>[], previous: SourceHealth[] = []): SourceHealth[] {
  return current.map((s) => {
    if (s.ok && s.items > 0) return s;
    const since = previous.find((p) => p.id === s.id)?.failingSince ?? now.toISOString();
    return { ...s, failingSince: since };
  });
}

/** Sources bad for 6+ hours, reported only in the first 2 hours of each day of the problem (one email a day). */
export function sourcesToReport(sources: SourceHealth[], now: Date, afterHours = 6): SourceHealth[] {
  return sources.filter((s) => {
    if (!s.failingSince) return false;
    const h = (now.getTime() - Date.parse(s.failingSince)) / 3_600_000;
    return h >= afterHours && (h - afterHours) % 24 < 2;
  });
}
