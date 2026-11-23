// Every tunable number in the game lives here, so balance can be changed without touching logic.
export const CONFIG = {
  game_name: 'Cap Table',
  time_zone: 'America/New_York',
  epoch: '2026-11-23', // day 0 of the live world (a Monday)
  world_seed: 'live-world-1',
  practice_seed: 'practice-world',

  season_days: 7, // stakes lock at the end of each season
  fund_size: 10_000_000,
  checks: { S: 250_000, M: 500_000, L: 1_000_000 },
  pitches_per_day: 3,
  deal_open_days: 2, // a pitch stays open this many days (never past its season's end)
  peeks_per_day: 1,
  sell_discount: 0.25, // selling a stake early returns value minus this share
  followon_window_days: 2, // after a raise, how long you can pay to keep your stake (season open only)
  round_dilution: 0.2, // each new round dilutes non-participating holders by this share

  traits: ['founder', 'market', 'traction'],
  scout: {
    base_width: 0.5, // range width (0-1 scale) before any peek
    peek_cut: 0.6, // a peek removes this share of the width
    level_cut: 0.1, // each scouting level removes this share of the width
    max_level: 3, // cap keeps veterans from running away with the game
    calls_per_level: 3, // good calls needed per level
    eval_lag_days: 14, // a call is judged this many days after it was made
    good_multiple: 2, // a backed company at this multiple counts as a good call
  },

  sim: {
    drift: 0.06, // daily log-growth for a perfect company, centred on quality 0.45
    vol: 0.15,
    raise_prob: 0.2,
    raise_step: 1.3, // value must be this multiple of the last round to raise again
    death_floor: 0.55,
    death_prob: 0.3,
    exit_min_multiple: 3,
    exit_prob: 0.07,
    mature_day: 40,
    mature_exit_prob: 0.03,
    quality_weights: { founder: 0.45, market: 0.35, traction: 0.2 },
    luck: 0.18, // hidden noise in quality, so even perfect scouting isn't certainty
  },

  rivals: [
    { name: 'Marlow Capital', style: 'aggressive' },
    { name: 'Bright Pine', style: 'balanced' },
    { name: 'Ostrich Fund', style: 'conservative' },
    { name: 'Lowtide Ventures', style: 'balanced' },
    { name: 'Kettle Partners', style: 'spray' },
    { name: 'Fable & Co', style: 'contrarian' },
  ],
  rival_styles: {
    aggressive: { bar: 0.5, size: 'L', followon: true },
    balanced: { bar: 0.56, size: 'M', followon: true },
    conservative: { bar: 0.64, size: 'M', followon: false },
    spray: { bar: 0.4, size: 'S', followon: false },
    contrarian: { bar: 0.35, size: 'M', followon: true, invert: true },
  },
};
