import { test } from 'node:test';
import assert from 'node:assert';
import { CONFIG } from '../src/config.mjs';
import { pitchesForDay, stateAt, companyPath, observe, openDeals, companyById } from '../src/world.mjs';
import { newFirm, invest, sell, followOn, followOnOffer, stakeAt, holdingValue, fundValue, peek, peeksLeft, widthFor, scoutLevel, standings, dayFromDate, fund } from '../src/game.mjs';

const SEED = 'test-seed';

test('the world is the same for everyone with the same seed', () => {
  assert.deepEqual(pitchesForDay(SEED, 3), pitchesForDay(SEED, 3));
  assert.notDeepEqual(pitchesForDay(SEED, 3).map((c) => c.traits), pitchesForDay('other', 3).map((c) => c.traits));
  const co = pitchesForDay(SEED, 0)[0];
  assert.equal(stateAt(SEED, co, 20).value, stateAt(SEED, co, 20).value);
});

test('outcomes follow a power law: many fail, a few run', () => {
  const mults = [];
  for (let d = 0; d < 40; d++) for (const co of pitchesForDay(SEED, d)) {
    const s = stateAt(SEED, co, d + 30);
    mults.push(s.status === 'dead' ? 0 : (s.exitValue ?? s.value) / co.post);
  }
  const dead = mults.filter((m) => m === 0).length / mults.length;
  assert.ok(dead > 0.15 && dead < 0.6, `dead share ${dead}`);
  assert.ok(Math.max(...mults) > 8, 'someone should run far');
});

test('scouting ranges always contain the truth and have the asked width', () => {
  for (const co of pitchesForDay(SEED, 1)) for (const t of CONFIG.traits) {
    const r = observe(SEED, co, t, 0.4);
    assert.ok(r.lo <= co.traits[t] && co.traits[t] <= r.hi);
    assert.ok(Math.abs(r.hi - r.lo - 0.4) < 1e-9);
  }
});

test('investing buys a stake at today\'s value and spends fund cash', () => {
  const firm = newFirm('t');
  const co = openDeals(SEED, 0)[0];
  const h = invest(firm, SEED, 0, co.id, 'M');
  assert.equal(fund(firm, 0).cash, CONFIG.fund_size - CONFIG.checks.M);
  assert.ok(Math.abs(h.stake - CONFIG.checks.M / stateAt(SEED, co, 0).value) < 1e-12);
  assert.throws(() => invest(firm, SEED, 0, co.id, 'S'), /already/);
});

test('deals close after their window and never cross into the next season', () => {
  const firm = newFirm('t');
  const co = pitchesForDay(SEED, 0)[0];
  assert.throws(() => invest(firm, SEED, CONFIG.deal_open_days, co.id, 'S'), /closed/);
  const last = pitchesForDay(SEED, CONFIG.season_days - 1)[0];
  assert.ok(!openDeals(SEED, CONFIG.season_days).some((c) => c.id === last.id));
});

test('a fund cannot overspend', () => {
  const firm = newFirm('t');
  fund(firm, 0).cash = 100;
  assert.throws(() => invest(firm, SEED, 0, openDeals(SEED, 0)[0].id, 'S'), /cash/);
});

function findRaise() {
  for (let s = 0; s < 8; s++) {
    const end = (s + 1) * CONFIG.season_days - 1;
    for (let d = s * CONFIG.season_days; d < end; d++) for (const co of pitchesForDay(SEED, d)) {
      const r = companyPath(SEED, co, end).find((p) => p.raised && p.day > d);
      if (r) return { co, buyDay: d, raiseDay: r.day };
    }
  }
  return null;
}

test('a raise dilutes you unless you pay to keep your stake', () => {
  const found = findRaise();
  assert.ok(found, 'test world should contain an in-season raise');
  const { co, buyDay, raiseDay } = found;
  const a = newFirm('a'), b = newFirm('b');
  const ha = invest(a, SEED, buyDay, co.id, 'S'), hb = invest(b, SEED, buyDay, co.id, 'S');
  assert.ok(followOnOffer(a, SEED, raiseDay, co.id));
  followOn(a, SEED, raiseDay, co.id);
  assert.ok(Math.abs(stakeAt(ha, SEED, raiseDay) - ha.stake) < 1e-12);
  assert.ok(stakeAt(hb, SEED, raiseDay) < hb.stake);
});

test('stakes lock at season end: no follow-ons after it', () => {
  const firm = newFirm('t');
  const co = openDeals(SEED, 0)[0];
  invest(firm, SEED, 0, co.id, 'S');
  for (let d = CONFIG.season_days; d < CONFIG.season_days + 30; d++) assert.equal(followOnOffer(firm, SEED, d, co.id), null);
});

test('selling early costs the discount and only works once', () => {
  const firm = newFirm('t');
  const co = openDeals(SEED, 0).find((c) => stateAt(SEED, c, 3).status === 'alive');
  const h = invest(firm, SEED, 0, co.id, 'M');
  const before = holdingValue(h, SEED, 3).value;
  const got = sell(firm, SEED, 3, co.id);
  assert.ok(Math.abs(got - before * (1 - CONFIG.sell_discount)) < 1e-6);
  assert.throws(() => sell(firm, SEED, 4, co.id), /nothing to sell/);
  assert.ok(Math.abs(fundValue(firm, 0, SEED, 3).total - (CONFIG.fund_size - CONFIG.checks.M + got)) < 1e-6);
});

test('a peek narrows one range, once per day', () => {
  const firm = newFirm('t');
  const co = openDeals(SEED, 0)[0];
  const before = widthFor(firm, SEED, 0, co.id, 'founder');
  peek(firm, SEED, 0, co.id, 'founder');
  assert.ok(widthFor(firm, SEED, 0, co.id, 'founder') < before);
  assert.equal(peeksLeft(firm, 0), CONFIG.peeks_per_day - 1);
  assert.throws(() => peek(firm, SEED, 0, co.id, 'market'), /no peeks/);
});

test('scouting level comes from good calls and is capped', () => {
  const firm = newFirm('t');
  let n = 0;
  for (let d = 0; d < 60 && n < 40; d++) for (const co of pitchesForDay(SEED, d)) {
    const s = stateAt(SEED, co, d + CONFIG.scout.eval_lag_days);
    const v = s.status === 'exited' ? s.exitValue : s.status === 'dead' ? 0 : s.value;
    if (v / co.post >= CONFIG.scout.good_multiple) { fund(firm, 999).holdings.push({ coId: co.id, day: d, stake: 0, invested: 1, protectedRaises: [], sold: null }); n++; }
  }
  const lvl = scoutLevel(firm, SEED, 200);
  assert.equal(lvl.level, CONFIG.scout.max_level);
  assert.ok(lvl.good >= CONFIG.scout.calls_per_level * CONFIG.scout.max_level);
});

test('standings rank you against every rival on the same deals', () => {
  const st = standings(newFirm('You'), SEED, 5);
  assert.equal(st.length, CONFIG.rivals.length + 1);
  for (let i = 1; i < st.length; i++) assert.ok(st[i - 1].multiple >= st[i].multiple);
  assert.equal(st.filter((r) => r.you).length, 1);
});

test('the live day counts from the epoch in New York time', () => {
  assert.equal(dayFromDate(new Date(`${CONFIG.epoch}T12:00:00-05:00`)), 0);
  assert.equal(dayFromDate(new Date(`${CONFIG.epoch}T23:30:00-05:00`)), 0);
  assert.equal(dayFromDate(new Date(Date.parse(`${CONFIG.epoch}T12:00:00-05:00`) + 86_400_000)), 1);
});

test('a company\'s history never includes days after the asked day', () => {
  const co = pitchesForDay(SEED, 0)[0];
  companyPath(SEED, co, 50);
  const p = companyPath(SEED, co, 10);
  assert.equal(p[p.length - 1].day, 10);
});
