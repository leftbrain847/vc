// Browser UI. Runs after config, world and game are inlined above it by scripts/build.mjs.
const STORE_KEY = 'cap_table_v1';
const App = {
  mode: 'practice',
  practiceDay: 0,
  firms: {},
  tab: 'city',
  sheet: null,
  toast: '',
};
const seedFor = () => (App.mode === 'live' ? CONFIG.world_seed : CONFIG.practice_seed);
const today = () => (App.mode === 'live' ? dayFromDate(new Date()) : App.practiceDay);
const me = () => (App.firms[App.mode] ||= newFirm('You'));

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (s) Object.assign(App, { mode: s.mode || 'practice', practiceDay: s.practiceDay || 0, firms: s.firms || {} });
  } catch { /* storage unavailable: play in memory */ }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ mode: App.mode, practiceDay: App.practiceDay, firms: App.firms })); } catch { /* ignore */ }
}

const money = (n) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : `$${Math.round(n / 1e3)}K`);
const pct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`;
const mult = (x) => `${x.toFixed(2)}x`;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
const fundName = (s) => `Fund ${ROMAN[s] || s + 1}`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hue = (id) => ['#2a8f84', '#334262', '#5f7ab7', '#6b5a8a', '#2c7d73', '#3a4a6a', '#7a5a8f', '#2f6f8f'][hash(id) % 8];

function act(fn) {
  try { fn(); App.toast = ''; } catch (e) { App.toast = e.message; }
  save(); render();
}

/* ---------- City ---------- */
function building(h, x, ground, seed, day) {
  const co = companyById(seed, h.coId);
  const hv = holdingValue(h, seed, day);
  const m = hv.value / h.invested;
  const w = Math.round(20 + Math.min(18, (h.invested / 1e6) * 14));
  const ht = Math.round(Math.min(200, 40 + 60 * Math.log2(1 + Math.max(0.1, m))));
  const y = ground - ht;
  let s = `<g class="bld" data-co="${h.coId}" tabindex="0" role="button" aria-label="${esc(co.name)}">`;
  if (hv.status === 'dead') {
    s += `<path d="M${x} ${ground} L${x} ${ground - 18} L${x + w * 0.4} ${ground - 10} L${x + w * 0.7} ${ground - 22} L${x + w} ${ground - 8} L${x + w} ${ground}Z" fill="#3a3f4b"/>`;
  } else if (hv.status === 'sold') {
    s += `<rect x="${x}" y="${ground - 16}" width="${w}" height="16" fill="#4a505e"/><rect x="${x + 3}" y="${ground - 28}" width="${w - 6}" height="10" rx="2" fill="#e9ecf2"/><text x="${x + w / 2}" y="${ground - 20}" font-size="7" text-anchor="middle" font-weight="800" fill="#14161c">SOLD</text>`;
  } else {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${ht}" fill="${hue(h.coId)}"/><rect x="${x + w - 5}" y="${y}" width="5" height="${ht}" fill="#000" opacity=".2"/>`;
    const cols = Math.max(1, Math.floor((w - 6) / 8));
    for (let r = 0; r < Math.floor((ht - 8) / 12); r++) for (let k = 0; k < cols; k++) {
      const on = (hash(h.coId + r + '-' + k) % 10) / 10 < Math.min(0.95, 0.25 + m / 3);
      s += `<rect x="${x + 4 + k * 8}" y="${y + 5 + r * 12}" width="4" height="6" fill="${on ? '#ffd877' : '#1a2030'}"/>`;
    }
    if (hv.status === 'exited') s += `<path d="M${x - 3} ${y} L${x + w / 2} ${y - 18} L${x + w + 3} ${y}Z" fill="#f2c14e"/>`;
    if (followOnOffer(me(), seed, day, h.coId)) s += `<circle cx="${x + w / 2}" cy="${y - 10}" r="4" fill="#ff5a4e"/><circle cx="${x + w / 2}" cy="${y - 10}" r="10" fill="#ff5a4e" opacity=".25"/>`;
  }
  s += `<text x="${x + w / 2}" y="${ground + 14}" font-size="8" text-anchor="middle" fill="#9aa1ad">${esc(co.name.slice(0, 7))}</text></g>`;
  return { svg: s, w };
}

function district(season, seed, day) {
  const firm = me();
  const f = fund(firm, season);
  const live = !isLocked(season, day);
  const ground = 250;
  let x = 10, parts = '';
  for (const h of f.holdings) { const b = building(h, x, ground, seed, day); parts += b.svg; x += b.w + 8; }
  if (live) for (const co of openDeals(seed, day)) {
    if (f.holdings.some((h) => h.coId === co.id)) continue;
    parts += `<g class="lot" data-tab="deals" role="button" tabindex="0" aria-label="Open deal ${esc(co.name)}"><rect x="${x}" y="${ground - 14}" width="26" height="14" fill="none" stroke="#f2c14e" stroke-dasharray="3 3"/><path d="M${x + 4} ${ground - 14} L${x + 4} ${ground - 60} L${x + 34} ${ground - 60}" stroke="#f2c14e" stroke-width="2" fill="none"/><path d="M${x + 28} ${ground - 60} L${x + 28} ${ground - 48}" stroke="#f2c14e"/></g>`;
    x += 42;
  }
  const width = Math.max(340, x + 10);
  const fv = fundValue(firm, season, seed, day);
  const label = live ? `${fundName(season)} · open · ${mult(fv.multiple)}` : `${fundName(season)} · locked · ${mult(fv.multiple)}`;
  const empty = !f.holdings.length && !live ? `<text x="150" y="200" font-size="11" text-anchor="middle" fill="#8e96a6">No companies backed this season</text>` : '';
  return `<div class="district${live ? ' now' : ''}" data-season="${season}"><svg viewBox="0 0 ${width} 280" width="${width}" height="280"><defs><linearGradient id="sky${season}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${live ? '#2a2440' : '#1a2236'}"/><stop offset="1" stop-color="${live ? '#e07a5f' : '#3a3f5a'}"/></linearGradient></defs><rect width="${width}" height="${ground}" fill="url(#sky${season})"/>${live ? `<circle cx="${width - 50}" cy="70" r="18" fill="#ffd877" opacity=".85"/>` : ''}${parts}${empty}<rect y="${ground}" width="${width}" height="30" fill="#151a24"/></svg><div class="dlabel">${label}</div></div>`;
}

function cityView(seed, day) {
  const season = seasonOf(day);
  const firm = me();
  const st = standings(firm, seed, day);
  const rank = st.findIndex((r) => r.you) + 1;
  const f = fund(firm, season);
  const left = seasonEnd(season) - day;
  const offers = [];
  for (const s of Object.keys(firm.funds)) for (const h of firm.funds[s].holdings) { const o = followOnOffer(firm, seed, day, h.coId); if (o) offers.push([h, o]); }
  const events = [];
  for (const s of Object.keys(firm.funds)) for (const h of firm.funds[s].holdings) {
    if (h.sold || h.day >= day) continue;
    const a = holdingValue(h, seed, day - 1).status, b = holdingValue(h, seed, day).status;
    if (a !== b) events.push([h, b]);
  }
  const deals = openDeals(seed, day).filter((c) => !f.holdings.some((h) => h.coId === c.id)).length;
  let districts = '';
  for (let s = 0; s <= season; s++) districts += district(s, seed, day);
  return `<section class="stats"><div><span class="k">This fund</span><b>${mult(fundValue(firm, season, seed, day).multiple)}</b></div><div><span class="k">Rank</span><b>#${rank} of ${st.length}</b></div><div><span class="k">Cash</span><b>${money(f.cash)}</b></div></section>
  <div class="city" id="city">${districts}</div>
  <p class="hint">${season > 0 ? 'Swipe right to stroll back through older funds. ' : ''}Tap a building to see the company.</p>
  <section class="today"><h2>Today</h2>
  ${offers.map(([h, o]) => `<button class="row alert" data-co="${h.coId}"><span><i class="dot"></i>${esc(companyById(seed, h.coId).name)} is raising</span><span class="pill co">keep your stake?</span></button>`).join('')}
  ${events.map(([h, s]) => `<button class="row" data-co="${h.coId}"><span>${esc(companyById(seed, h.coId).name)} ${s === 'exited' ? 'was acquired' : 'shut down'}</span><span class="pill ${s === 'exited' ? 'go' : 'co'}">${s === 'exited' ? 'exit' : 'failed'}</span></button>`).join('')}
  <button class="row" data-tab="deals"><span>${deals} deal${deals === 1 ? '' : 's'} open in Deal Flow</span><span class="pill go">Review</span></button>
  <div class="row static"><span>Stakes in ${fundName(season)} lock</span><span class="n">${left === 0 ? 'tonight' : `in ${left} day${left === 1 ? '' : 's'}`}</span></div></section>`;
}

/* ---------- Deal Flow ---------- */
function rangeBar(r, peeked) {
  return `<div class="range"><i style="left:${r.lo * 100}%;width:${Math.max(3, (r.hi - r.lo) * 100)}%" class="${peeked ? 'sharp' : ''}"></i></div><span class="grade">${grade(r.lo)}${grade(r.lo) === grade(Math.min(0.999, r.hi)) ? '' : '–' + grade(Math.min(0.999, r.hi))}</span>`;
}
function dealsView(seed, day) {
  const firm = me();
  const season = seasonOf(day);
  const f = fund(firm, season);
  const lvl = scoutLevel(firm, seed, day);
  const deals = openDeals(seed, day);
  const peeks = peeksLeft(firm, day);
  const cards = deals.map((co) => {
    const held = f.holdings.find((h) => h.coId === co.id);
    const value = stateAt(seed, co, day).value;
    const closes = Math.min(co.born + CONFIG.deal_open_days - 1, seasonEnd(season)) - day;
    const ht = heat(seed, co);
    const traits = CONFIG.traits.map((t) => {
      const peeked = firm.revealed[co.id]?.includes(t);
      const r = view(firm, seed, day, co, t);
      const label = t === 'traction' ? `Traction <small>~$${Math.round(5 + 120 * r.lo * r.lo)}–${Math.round(5 + 120 * r.hi * r.hi)}K/mo</small>` : t[0].toUpperCase() + t.slice(1);
      return `<div class="trait"><span class="tl">${label}</span>${rangeBar(r, peeked)}${!peeked && !held && peeks > 0 ? `<button class="peek" data-peek="${co.id}|${t}">Peek</button>` : '<span class="peek-sp"></span>'}</div>`;
    }).join('');
    const buy = held
      ? `<div class="held">Backed ${money(held.invested)} · ${pct(held.stake)}</div>`
      : firm.passed[co.id] !== undefined
        ? `<div class="held muted">Passed</div>`
        : `<div class="buy">${Object.entries(CONFIG.checks).map(([k, a]) => `<button data-invest="${co.id}|${k}" ${f.cash < a ? 'disabled' : ''}><b>${money(a)}</b><small>${pct(a / value)}</small></button>`).join('')}<button class="ghost" data-pass="${co.id}">Pass</button></div>`;
    return `<article class="deal${held ? ' backed' : ''}"><header><div><h3>${esc(co.name)}</h3><p>${esc(co.sector)} · ${esc(co.founder_name)}, founder</p></div><div class="heat" title="Rival firms interested">${'<i></i>'.repeat(Math.min(5, ht))}<small>${ht} firm${ht === 1 ? '' : 's'}</small></div></header>
      ${traits}<p class="meta">Valued at ${money(value)} · closes ${closes === 0 ? 'tonight' : `in ${closes} day${closes === 1 ? '' : 's'}`}</p>${buy}</article>`;
  }).join('');
  return `<section class="stats"><div><span class="k">Peeks today</span><b>${peeks}</b></div><div><span class="k">Scouting</span><b>Lv ${lvl.level}</b></div><div><span class="k">Cash</span><b>${money(f.cash)}</b></div></section>
  <p class="hint">Ranges always contain the truth. A peek narrows one; scouting levels narrow all of them, earned by good calls (max level ${CONFIG.scout.max_level}).</p>
  ${cards || '<p class="hint">No open deals right now.</p>'}`;
}

/* ---------- Standings ---------- */
function standingsView(seed, day) {
  const season = seasonOf(day);
  const st = standings(me(), seed, day);
  return `<h2 class="h">${fundName(season)} standings</h2><p class="hint">Every firm saw the same deals. Season ends in ${seasonEnd(season) - day + 1} day(s).</p>
  <table class="tbl"><thead><tr><th>#</th><th>Firm</th><th class="r">Fund</th><th class="r">Career</th></tr></thead><tbody>${st.map((r, i) => `<tr class="${r.you ? 'you' : ''}"><td>${i + 1}</td><td>${esc(r.name)}</td><td class="r">${mult(r.multiple)}</td><td class="r">${mult(r.career)}</td></tr>`).join('')}</tbody></table>`;
}

/* ---------- Company sheet ---------- */
function sheetView(seed, day, coId) {
  const firm = me();
  const co = companyById(seed, coId);
  const h = Object.values(firm.funds).flatMap((f) => f.holdings).find((x) => x.coId === coId);
  const path = companyPath(seed, co, day).filter((p) => p.day >= (h ? h.day : co.born));
  const vals = path.map((p) => (p.status === 'exited' ? p.exitValue : p.status === 'dead' ? 0 : p.value));
  const mx = Math.max(...vals, 1), W = 260, H = 70;
  const pts = vals.map((v, i) => `${(vals.length === 1 ? 0 : (i / (vals.length - 1)) * W).toFixed(1)},${(H - 4 - (v / mx) * (H - 8)).toFixed(1)}`).join(' ');
  const hv = h ? holdingValue(h, seed, day) : null;
  const offer = h ? followOnOffer(firm, seed, day, coId) : null;
  const locked = h ? isLocked(seasonOf(h.day), day) : false;
  const raises = path.filter((p) => p.raised).length;
  return `<div class="sheet-bg" data-close="1"></div><div class="sheet" role="dialog" aria-label="${esc(co.name)}"><button class="x" data-close="1" aria-label="Close">×</button>
  <h2>${esc(co.name)}</h2><p class="k">${esc(co.sector)} · ${esc(co.founder_name)}, founder · ${h ? fundName(seasonOf(h.day)) : ''}</p>
  <svg class="spark" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${hv && hv.value < h.invested ? '#ff5a4e' : '#2fc6b0'}" stroke-width="2.5"/></svg>
  ${h ? `<div class="kv"><span>Invested</span><b>${money(h.invested)}</b><span>Stake now</span><b>${pct(stakeAt(h, seed, day))}</b><span>Worth</span><b>${money(hv.value)} · ${mult(hv.value / h.invested)}</b><span>Status</span><b>${hv.status}${raises ? ` · ${raises} raise${raises > 1 ? 's' : ''}` : ''}</b></div>` : ''}
  ${offer ? `<div class="offer"><b>Raising now.</b> Pay ${money(offer.cost)} to keep ${pct(offer.keep)}, or do nothing and drop to ${pct(offer.diluted)}.<button data-follow="${coId}">Keep my stake · ${money(offer.cost)}</button></div>` : ''}
  ${h && hv.status === 'alive' ? `<button class="sell" data-sell="${coId}">Sell now for ${money(hv.value * (1 - CONFIG.sell_discount))} <small>(${pct(CONFIG.sell_discount)} below value)</small></button>` : ''}
  <p class="hint">${locked ? 'This fund is locked: no new money. It plays out on its own; you can sell any time.' : 'Stakes lock when the season ends. After that you only watch, or sell.'}</p></div>`;
}

/* ---------- Shell ---------- */
function render() {
  const seed = seedFor(), day = today();
  const season = seasonOf(day);
  const body = App.tab === 'city' ? cityView(seed, day) : App.tab === 'deals' ? dealsView(seed, day) : standingsView(seed, day);
  document.getElementById('app').innerHTML = `<header class="top"><div><h1>${CONFIG.game_name}</h1><p class="k">Season ${season + 1} · Day ${day - seasonStart(season) + 1} of ${CONFIG.season_days}</p></div>
    <div class="mode"><button data-mode="practice" class="${App.mode === 'practice' ? 'on' : ''}">Practice</button><button data-mode="live" class="${App.mode === 'live' ? 'on' : ''}">Live</button></div></header>
    ${App.mode === 'practice' ? `<div class="ff"><span>Practice world: move time yourself.</span><button data-next="1">Next day ›</button></div>` : ''}
    ${App.toast ? `<div class="toast" role="status">${esc(App.toast)}</div>` : ''}
    <main>${body}</main>
    <nav class="tabs">${[['city', 'City'], ['deals', 'Deal Flow'], ['standings', 'Standings']].map(([k, l]) => `<button data-tab="${k}" class="${App.tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>
    ${App.sheet ? sheetView(seed, day, App.sheet) : ''}`;
  const city = document.getElementById('city');
  if (city) city.scrollLeft = city.scrollWidth;
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, [data-co], [data-tab]');
  if (!t) return;
  const seed = seedFor(), day = today(), d = t.dataset;
  if (d.close) { App.sheet = null; return render(); }
  if (d.tab) { App.tab = d.tab; App.sheet = null; return render(); }
  if (d.mode) { App.mode = d.mode; App.sheet = null; save(); return render(); }
  if (d.next) { App.practiceDay++; save(); return render(); }
  if (d.peek) { const [id, tr] = d.peek.split('|'); return act(() => peek(me(), seed, day, id, tr)); }
  if (d.invest) { const [id, k] = d.invest.split('|'); return act(() => invest(me(), seed, day, id, k)); }
  if (d.pass) return act(() => pass(me(), day, d.pass));
  if (d.follow) return act(() => followOn(me(), seed, day, d.follow));
  if (d.sell) return act(() => { sell(me(), seed, day, d.sell); App.sheet = null; });
  if (d.co) { App.sheet = d.co; return render(); }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && App.sheet) { App.sheet = null; render(); }
  if (e.key === 'Enter' && e.target.matches('g[data-co], g[data-tab]')) e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
load();
render();
