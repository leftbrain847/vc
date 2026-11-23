// The shared world: every player with the same seed sees the same companies, on the same days, with the same fates.
// Pure and deterministic: no clock, no Math.random.
import { CONFIG } from './config.mjs';

export function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}
export function rand(...parts) {
  let t = (hash(parts.join('|')) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function gauss(...parts) {
  const u = Math.max(1e-9, rand(...parts, 'a'));
  const v = rand(...parts, 'b');
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export const seasonOf = (day, cfg = CONFIG) => Math.floor(day / cfg.season_days);
export const seasonStart = (season, cfg = CONFIG) => season * cfg.season_days;
export const seasonEnd = (season, cfg = CONFIG) => seasonStart(season, cfg) + cfg.season_days - 1;

const NAME_A = ['Kest', 'Salt', 'Nim', 'Juni', 'Brin', 'Ledg', 'Quor', 'Pant', 'Moss', 'Tide', 'Ferr', 'Orb', 'Lum', 'Hale', 'Corv', 'Vela', 'Rook', 'Fen', 'Arbo', 'Quill', 'Lark', 'Cinder', 'Mar', 'Opal'];
const NAME_B = ['rel', 'box', 'bus', 'per', 'e', 'erline', 'um', 'ry', 'work', 'well', 'o', 'it', 'en', 'ly', 'ix', 'ra', 'stack', 'ward', 'labs', 'grid', 'field', 'path', 'loop', 'yard'];
const SECTORS = ['Drone insurance', 'Ghost kitchens', 'Weather hedges', 'Pet telehealth', 'Battery recycling', 'AP automation', 'Board meeting AI', 'Grocery for clinics', 'Robot lawn care', 'Water rights data', 'Steel recycling', 'Freight matching', 'Dental billing', 'Solar permits', 'Tutor marketplace', 'Crop sensors', 'Legal intake AI', 'Fleet charging', 'Clinic scheduling', 'Warehouse robots'];
const FIRST = ['Ana', 'Dev', 'Kay', 'Sam', 'Ri', 'Lena', 'Omar', 'Priya', 'Theo', 'Mara', 'Jun', 'Nia', 'Ezra', 'Ines', 'Cole', 'Wren'];

export function pitchesForDay(seed, day, cfg = CONFIG) {
  const out = [];
  for (let i = 0; i < cfg.pitches_per_day; i++) {
    const id = `${day}-${i}`;
    const r = (k) => rand(seed, 'co', id, k);
    const founder = r('f');
    const market = r('m');
    const traction = r('t');
    const w = cfg.sim.quality_weights;
    const quality = clamp01(w.founder * founder + w.market * market + w.traction * traction + cfg.sim.luck * gauss(seed, 'co', id, 'luck'));
    const heat = Math.round(r('heat') * 2 + (founder + traction) * 1.5);
    const pre = Math.round((6 + 14 * traction + 4 * r('pre')) * (1 + 0.15 * heat)) * 1_000_000;
    out.push({
      id, born: day,
      name: NAME_A[Math.floor(r('n1') * NAME_A.length)] + NAME_B[Math.floor(r('n2') * NAME_B.length)],
      sector: SECTORS[Math.floor(r('s') * SECTORS.length)],
      founder_name: FIRST[Math.floor(r('fn') * FIRST.length)],
      revenue_k: Math.round(5 + 120 * traction * traction),
      traits: { founder, market, traction },
      quality,
      post: pre * 1.25,
    });
  }
  return out;
}

const pathCache = new Map();
// Day-by-day value of a company from birth to `day`. Each entry: { day, value, status, raised, exitValue }.
export function companyPath(seed, co, day, cfg = CONFIG) {
  const key = `${seed}|${co.id}`;
  let path = pathCache.get(key);
  if (!path) {
    path = [{ day: co.born, value: co.post, status: 'alive', raised: false, lastRound: co.post }];
    pathCache.set(key, path);
  }
  const s = cfg.sim;
  while (path[path.length - 1].day < day) {
    const prev = path[path.length - 1];
    const d = prev.day + 1;
    if (prev.status !== 'alive') { path.push({ ...prev, day: d, raised: false }); continue; }
    const g = s.drift * 2 * (co.quality - 0.45) + s.vol * gauss(seed, 'path', co.id, d);
    const value = prev.value * Math.exp(g);
    const age = d - co.born;
    const r = (k) => rand(seed, 'ev', co.id, d, k);
    let status = 'alive', raised = false, lastRound = prev.lastRound, exitValue;
    if (value < s.death_floor * co.post && r('death') < s.death_prob) status = 'dead';
    else if ((value >= s.exit_min_multiple * co.post && r('exit') < s.exit_prob) || (age >= s.mature_day && r('mature') < s.mature_exit_prob)) {
      status = 'exited'; exitValue = value;
    } else if (value >= s.raise_step * prev.lastRound && r('raise') < s.raise_prob) {
      raised = true; lastRound = value;
    }
    path.push({ day: d, value, status, raised, lastRound, exitValue });
  }
  // The cache may run ahead of `day`; never hand out the future.
  return path.slice(0, Math.max(0, day - co.born + 1));
}
export const stateAt = (seed, co, day, cfg = CONFIG) => companyPath(seed, co, day, cfg).find((p) => p.day === day);

// Deals a player can still back on `day`: born within the open window and inside the current season.
export function openDeals(seed, day, cfg = CONFIG) {
  const season = seasonOf(day, cfg);
  const out = [];
  for (let b = Math.max(seasonStart(season, cfg), day - cfg.deal_open_days + 1); b <= day; b++) {
    for (const co of pitchesForDay(seed, b, cfg)) if (stateAt(seed, co, day, cfg).status === 'alive') out.push(co);
  }
  return out;
}
export const companyById = (seed, id, cfg = CONFIG) => pitchesForDay(seed, Number(id.split('-')[0]), cfg).find((c) => c.id === id);

// What a scout sees of a hidden 0-1 trait: a range of the given width that always contains the truth.
export function observe(seed, co, trait, width) {
  const v = co.traits[trait];
  const u = rand(seed, 'obs', co.id, trait);
  let lo = v - width * u, hi = v + width * (1 - u);
  if (lo < 0) { hi -= lo; lo = 0; }
  if (hi > 1) { lo -= hi - 1; hi = 1; }
  return { lo: clamp01(lo), hi: clamp01(hi) };
}
const GRADES = ['F', 'D', 'C', 'B', 'A'];
export const grade = (x) => GRADES[Math.min(4, Math.floor(x * 5))];
