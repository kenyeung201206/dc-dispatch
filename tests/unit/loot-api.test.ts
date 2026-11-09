import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet } from '../../functions/api/loot.ts';

const TXT = `Daily Escalation Target Loot\nDate: 2026-11-09\n\nMissions:\n- The Art Museum: Unit Alloys\n- Camp White Oak: LMG\n- The Pentagon: Mystery Thing\n\nVendor Caches:\n- Weapons: SMGs\n`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('/api/loot (live 戰鬥升級 list)', () => {
  it('returns the list with Chinese names, English names and icons', async () => {
    vi.useFakeTimers({ now: new Date('2026-11-09T08:05:00Z'), toFake: ['Date'] });
    const fetch = vi.fn(async () => new Response(TXT));
    vi.stubGlobal('fetch', fetch);
    const body = await (await onRequestGet()).json();
    expect(fetch).toHaveBeenCalledWith('https://prototrack.gg/target-loot/target-loot-current.txt', expect.anything());
    expect(body).toEqual({
      status: 'ok',
      date: '2026-11-09',
      url: 'https://prototrack.gg/target-loot/target-loot.php',
      missions: [
        { place: '美術館', reward: '特種合金', kind: 'brand', hit: { en: 'Unit Alloys', icon: '/icons/brand/unit-alloys.png', tint: 'white' } },
        { place: '白橡木', reward: '輕機槍', kind: 'weapon', hit: { en: 'LMG', icon: '/icons/weapon/lmg.png', tint: 'white' } },
        { place: '五角', reward: 'Mystery Thing', kind: 'other', hit: null },
      ],
      vendor: [{ name: '衝鋒槍', hit: { en: 'SMG', icon: '/icons/weapon/smg.png', tint: 'white' } }],
    });
  });
  it("doesn't show a list dated after today's loot day, and reports ProtoTrack being down", async () => {
    vi.useFakeTimers({ now: new Date('2026-11-09T07:59:00Z'), toFake: ['Date'] });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(TXT)));
    expect(await (await onRequestGet()).json()).toEqual({ status: 'none' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    expect((await onRequestGet()).status).toBe(502);
  });
});
