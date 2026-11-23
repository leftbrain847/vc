// Player rules: funds per season, investing, peeking, following on, selling, scouting and standings.
// Pure functions over a plain state object, so the same code runs the player, the rivals and the tests.
import { CONFIG } from './config.mjs';
import { seasonOf, seasonEnd, openDeals, companyById, companyPath, stateAt, observe, pitchesForDay, seasonStart } from './world.mjs';

export const newFirm = (name) => ({ name, funds: {}, peeks: {}, revealed: {}, passed: {} });

export function fund(firm, season, cfg = CONFIG) {
  if (!firm.funds[season]) firm.funds[season] = { cash: cfg.fund_size, holdings: [] };
  return firm.funds[season];
}
const holdingOf = (firm, coId) => {
  for (const f of Object.values(firm.funds)) { const h = f.holdings.find((x) => x.coId === coId); if (h) return h; }
  return null;
};
export const isLocked = (season, day, cfg = CONFIG) => day > seasonEnd(season, cfg);

export function invest(firm, seed, day, coId, size, cfg = CONFIG) {
  const amount = cfg.checks[size];
  if (!amount) throw new Error(`unknown check size ${size}`);
  if (!openDeals(seed, day, cfg).some((c) => c.id === coId)) throw new Error('this deal is closed');
  if (holdingOf(firm, coId)) throw new Error('you already backed this company');
  const f = fund(firm, seasonOf(day, cfg), cfg);
  if (f.cash < amount) throw new Error('not enough cash left in this fund');
  const co = companyById(seed, coId, cfg);
  const value = stateAt(seed, co, day, cfg).value;
  f.cash -= amount;
  f.holdings.push({ coId, invested: amount, stake: amount / value, day, protectedRaises: [], sold: null });
  return f.holdings[f.holdings.length - 1];
}

// Raises after purchase that the holder didn't pay to follow.
export function stakeAt(h, seed, day, cfg = CONFIG) {
  const co = companyById(seed, h.coId, cfg);
  let stake = h.stake;
  for (const p of companyPath(seed, co, day, cfg)) if (p.raised && p.day > h.day && !h.protectedRaises.includes(p.day)) stake *= 1 - cfg.round_dilution;
  return stake;
}

export function followOnOffer(firm, seed, day, coId, cfg = CONFIG) {
  const h = holdingOf(firm, coId);
  if (!h || h.sold) return null;
  const season = seasonOf(h.day, cfg);
  if (isLocked(season, day, cfg)) return null;
  const co = companyById(seed, coId, cfg);
  const path = companyPath(seed, co, day, cfg);
  const raise = [...path].reverse().find((p) => p.raised && p.day > h.day && day - p.day < cfg.followon_window_days);
  if (!raise || h.protectedRaises.includes(raise.day) || path[path.length - 1].status !== 'alive') return null;
  const cost = stakeAt(h, seed, raise.day - 1, cfg) * cfg.round_dilution * raise.value;
  return { raiseDay: raise.day, cost, keep: stakeAt(h, seed, raise.day - 1, cfg), diluted: stakeAt(h, seed, raise.day - 1, cfg) * (1 - cfg.round_dilution) };
}

export function followOn(firm, seed, day, coId, cfg = CONFIG) {
  const offer = followOnOffer(firm, seed, day, coId, cfg);
  if (!offer) throw new Error('no follow-on available');
  const h = holdingOf(firm, coId);
  const f = fund(firm, seasonOf(h.day, cfg), cfg);
  if (f.cash < offer.cost) throw new Error('not enough cash left in this fund');
  f.cash -= offer.cost;
  h.invested += offer.cost;
  h.protectedRaises.push(offer.raiseDay);
  return offer;
}

// Current worth of a holding to its fund: realised cash for exits and sales, a mark for live companies.
export function holdingValue(h, seed, day, cfg = CONFIG) {
  if (h.sold && h.sold.day <= day) return { value: h.sold.proceeds, status: 'sold' };
  const co = companyById(seed, h.coId, cfg);
  const st = stateAt(seed, co, day, cfg);
  const stake = stakeAt(h, seed, day, cfg);
  if (st.status === 'dead') return { value: 0, status: 'dead' };
  if (st.status === 'exited') return { value: stake * st.exitValue, status: 'exited' };
  return { value: stake * st.value, status: 'alive' };
}

export function sell(firm, seed, day, coId, cfg = CONFIG) {
  const h = holdingOf(firm, coId);
  if (!h || h.sold) throw new Error('nothing to sell');
  const hv = holdingValue(h, seed, day, cfg);
  if (hv.status !== 'alive') throw new Error('this company is no longer trading');
  const proceeds = hv.value * (1 - cfg.sell_discount);
  h.sold = { day, proceeds };
  return proceeds;
}

export function fundValue(firm, season, seed, day, cfg = CONFIG) {
  const f = fund(firm, season, cfg);
  let total = f.cash;
  for (const h of f.holdings) if (h.day <= day) total += holdingValue(h, seed, day, cfg).value;
  return { total, multiple: total / cfg.fund_size };
}

// Scouting: a range narrows when you peek, and narrows further with a level earned from good calls.
export function scoutLevel(firm, seed, day, cfg = CONFIG) {
  const sc = cfg.scout;
  let good = 0;
  for (const f of Object.values(firm.funds)) for (const h of f.holdings) {
    const judge = h.day + sc.eval_lag_days;
    if (judge > day) continue;
    const co = companyById(seed, h.coId, cfg);
    const st = stateAt(seed, co, judge, cfg);
    const v = st.status === 'exited' ? st.exitValue : st.status === 'dead' ? 0 : st.value;
    if (v / stateAt(seed, co, h.day, cfg).value >= sc.good_multiple) good++;
  }
  for (const [coId, d] of Object.entries(firm.passed)) {
    if (d + sc.eval_lag_days > day) continue;
    if (stateAt(seed, companyById(seed, coId, cfg), d + sc.eval_lag_days, cfg).status === 'dead') good++;
  }
  return { level: Math.min(sc.max_level, Math.floor(good / sc.calls_per_level)), good };
}

export function widthFor(firm, seed, day, coId, trait, cfg = CONFIG) {
  const sc = cfg.scout;
  let w = sc.base_width * (1 - sc.level_cut * scoutLevel(firm, seed, day, cfg).level);
  if (firm.revealed[coId]?.includes(trait)) w *= 1 - sc.peek_cut;
  return w;
}
export const view = (firm, seed, day, co, trait, cfg = CONFIG) => observe(seed, co, trait, widthFor(firm, seed, day, co.id, trait, cfg));

export const peeksLeft = (firm, day, cfg = CONFIG) => cfg.peeks_per_day - (firm.peeks[day] || 0);
export function peek(firm, seed, day, coId, trait, cfg = CONFIG) {
  if (!cfg.traits.includes(trait)) throw new Error(`unknown trait ${trait}`);
  if (peeksLeft(firm, day, cfg) <= 0) throw new Error('no peeks left today');
  if (firm.revealed[coId]?.includes(trait)) throw new Error('already peeked');
  firm.peeks[day] = (firm.peeks[day] || 0) + 1;
  (firm.revealed[coId] ||= []).push(trait);
  return view(firm, seed, day, companyById(seed, coId, cfg), trait, cfg);
}
export const pass = (firm, day, coId) => { firm.passed[coId] = day; };

// Rival firms play the same world with simple styles and no peeks.
export function rivalScore(seed, co, cfg = CONFIG) {
  const w = cfg.sim.quality_weights;
  let s = 0;
  for (const t of cfg.traits) { const r = observe(seed, co, t, cfg.scout.base_width); s += w[t] * (r.lo + r.hi) / 2; }
  return s;
}
export function simulateRival(rival, seed, day, cfg = CONFIG) {
  const style = cfg.rival_styles[rival.style];
  const firm = newFirm(rival.name);
  for (let d = 0; d <= day; d++) {
    for (const co of pitchesForDay(seed, d, cfg)) {
      const s = rivalScore(seed, co, cfg);
      const keen = style.invert ? s < style.bar : s >= style.bar;
      if (keen) { try { invest(firm, seed, d, co.id, style.size, cfg); } catch { /* out of cash or closed */ } }
    }
    if (style.followon) for (const f of Object.values(firm.funds)) for (const h of f.holdings) {
      try { followOn(firm, seed, d, h.coId, cfg); } catch { /* no offer */ }
    }
  }
  return firm;
}

// How many rival firms backed (or will back by its close) a deal: shown as "firms circling".
export function heat(seed, co, cfg = CONFIG) {
  const s = rivalScore(seed, co, cfg);
  return cfg.rivals.filter((r) => { const st = cfg.rival_styles[r.style]; return st.invert ? s < st.bar : s >= st.bar; }).length;
}

export function standings(player, seed, day, cfg = CONFIG) {
  const season = seasonOf(day, cfg);
  const firms = [player, ...cfg.rivals.map((r) => simulateRival(r, seed, day, cfg))];
  return firms.map((f) => {
    const seasons = [];
    for (let s = 0; s <= season; s++) seasons.push(fundValue(f, s, seed, day, cfg).multiple);
    return { name: f.name, you: f === player, multiple: seasons[season], career: seasons.reduce((a, b) => a + b, 0) / seasons.length };
  }).sort((a, b) => b.multiple - a.multiple);
}

export const dayFromDate = (now, cfg = CONFIG) => {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.time_zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return Math.max(0, Math.round((Date.parse(`${local}T00:00:00Z`) - Date.parse(`${cfg.epoch}T00:00:00Z`)) / 86_400_000));
};
export { seasonOf, seasonStart, seasonEnd };
