import { describe, expect, it } from 'vitest';
import { learnNames } from '../../pipeline/learn-names.ts';

// The real 11/09 lists: ProtoTrack (English) and 巴哈's daily post (Chinese), same missions in the same order.
const english = [
  { place: 'The Art Museum', reward: 'Golan Gear Ltd' },
  { place: 'Manning National Zoo', reward: 'Assault Rifle' },
  { place: 'Camp White Oak', reward: 'Ember Engine' },
  { place: 'The Pentagon', reward: 'Gear Mods' },
  { place: 'DARPA Research Labs', reward: 'Pistol' },
];
const chinese = [
  { place: '美術館', reward: '戈蘭' },
  { place: '曼寧', reward: 'AR' },
  { place: '白橡木', reward: '餘燼' },
  { place: '五角', reward: '裝備模組' },
  { place: '國防實驗室', reward: '手槍' },
];
const e = (en: string, aliases: string[], icon = '/icons/x.png') => ({ en, aliases, icon });
// As it was before 餘燼引擎/裝備模組 were added: those two had only English names (taken from ProtoTrack).
const brands = () => ({
  brands: [e('Golan Gear', ['戈蘭', 'Golan Gear', 'Golan Gear Ltd'])],
  sets: [e('Ember Engine', ['Ember Engine'])],
  slots: [e('Assault Rifle', ['突擊步槍', 'Assault Rifle', 'AR']), e('Gear Mods', ['Gear Mods']), e('Pistol', ['手槍', 'Pistol'])],
});
const places = (drop: string[] = []) => ({
  places: Object.fromEntries(
    [
      ['The Art Museum', '美術館'],
      ['Manning National Zoo', '曼寧'],
      ['Camp White Oak', '白橡木'],
      ['The Pentagon', '五角'],
      ['DARPA Research Labs', '國防實驗室'],
    ].filter(([en]) => !drop.includes(en!)),
  ),
});

describe('learning Chinese names from 巴哈 (same day, same order)', () => {
  it('learns unknown places and rewards when the known ones line up', () => {
    expect(learnNames(english, chinese, places(['The Pentagon', 'Camp White Oak']), brands())).toEqual({
      places: { 'Camp White Oak': '白橡木', 'The Pentagon': '五角' },
      rewards: [
        { en: 'Ember Engine', zh: '餘燼' },
        { en: 'Gear Mods', zh: '裝備模組' },
      ],
    });
  });
  it('learns nothing when a known name disagrees (lists in a different order, or a different day)', () => {
    const swapped = [chinese[1]!, chinese[0]!, ...chinese.slice(2)];
    expect(learnNames(english, swapped, places(['The Pentagon']), brands())).toBeUndefined();
    const otherDay = chinese.map((c, i) => (i === 4 ? { ...c, reward: '戈蘭' } : c));
    expect(learnNames(english, otherDay, places(['The Pentagon']), brands())).toBeUndefined();
  });
  it('learns nothing without at least 2 agreeing names, or when the lists differ in length', () => {
    const allNew = english.map((m, i) => ({ place: `Place ${i}`, reward: `Thing ${i}` }));
    expect(learnNames(allNew, chinese, places(), { brands: [], sets: [], slots: [] })).toBeUndefined();
    expect(learnNames(english.slice(0, 4), chinese, places(), brands())).toBeUndefined();
  });
  it("never gives a name we don't have an entry for, nor one already used by another item", () => {
    const b = brands();
    b.sets = []; // no entry (no icon) for Ember Engine: its name waits
    const learned = learnNames(english, chinese, places(), b);
    expect(learned?.rewards).toEqual([{ en: 'Gear Mods', zh: '裝備模組' }]);
    const used = learnNames(english, chinese.map((c, i) => (i === 3 ? { ...c, reward: '手槍' } : c)), places(), brands());
    expect(used).toBeUndefined(); // 手槍 belongs to Pistol, so position 4 disagrees
  });
});

describe('full names from other sources', () => {
  it("are only a fallback: 巴哈's own name is still learned and wins", () => {
    const p = { ...places(['The Pentagon']), fromOtherSources: { 'The Pentagon': '五角大廈' } };
    expect(learnNames(english, chinese, p, brands())?.places).toEqual({ 'The Pentagon': '五角' });
  });
});

describe("the owner's place names (data/places.json fromOwner)", async () => {
  const { parseProtoTrack } = await import('../../pipeline/sources/prototrack.ts');
  it('are always shown, and never block learning from 巴哈', () => {
    const txt = 'Date: 2026-11-18\nMissions:\n- Capitol Building: Mask\n- Jefferson Plaza: Mask\n- Lincoln Memorial: Mask\n- Federal Emergency Bunker: Mask\n';
    expect(parseProtoTrack(txt)!.missions.map((m) => m.place)).toEqual(['國會大廈', '傑佛遜廣場', '林肯紀念堂', '聯邦緊急地堡']);
    // learnNames only compares 巴哈's own names (places.places), so a shorter 巴哈 form can't cause a mismatch.
    const eng = [{ place: 'Capitol Building', reward: 'Golan Gear Ltd' }, ...english.slice(1)];
    const zh = [{ place: '國會', reward: '戈蘭' }, ...chinese.slice(1)];
    expect(learnNames(eng, zh, places(), brands())?.places).toEqual({ 'Capitol Building': '國會' });
  });
});
