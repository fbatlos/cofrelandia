import { hashSeed, mulberry32 } from './rng.mjs';
import { playerStats } from './equip.mjs';
import { openChest } from './loot.mjs';

export const MAX_ROUNDS = 30;
export const FIGHTS_PER_WEEK = 3;
export const POINTS = { win: 3, draw: 1, bye: 2 };
/** Prize chests by final rank (index 0 = rank 1). Beauty top 3 also get one. */
export const PRIZE_RANKS = [3, 2, 2, 1, 1, 1, 1, 1, 1, 1];
const BEAUTY_PRIZES = 3;
const BEAUTY_LIST = 10;
const FEATURED = 3;

/** ISO-8601 week id such as "2026-W48" for a timestamp (UTC). */
export function weekId(ts) {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday - Date.UTC(year, 0, 1)) / 86400000 / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/**
 * Deterministic duel. Fighters: {name, atk, def, luck, life, heal}.
 * Each round a acts then b. An action is an attack, or a one-off heal when hp <= 35% of max.
 * Returns {winner:'a'|'b'|'draw', hpA, hpB, rounds:[{n, actor:'a'|'b', kind:'hit'|'crit'|'heal', amount, hpA, hpB}]}.
 */
export function simulateBattle(a, b, seed) {
  const rnd = mulberry32(hashSeed(`duel:${seed}`));
  const side = { a: { ...a, hp: a.life, healed: false }, b: { ...b, hp: b.life, healed: false } };
  const first = a.luck === b.luck ? (rnd() < 0.5 ? 'a' : 'b') : a.luck > b.luck ? 'a' : 'b';
  const order = first === 'a' ? ['a', 'b'] : ['b', 'a'];
  const rounds = [];
  for (let n = 1; n <= MAX_ROUNDS && side.a.hp > 0 && side.b.hp > 0; n++) {
    for (const who of order) {
      const me = side[who];
      const foe = side[who === 'a' ? 'b' : 'a'];
      if (me.hp <= 0 || foe.hp <= 0) break;
      let kind = 'hit';
      let amount;
      if (!me.healed && me.heal > 0 && me.hp <= me.life * 0.35) {
        me.healed = true;
        amount = Math.min(me.heal, Math.round(me.life * 0.5), me.life - me.hp);
        me.hp += amount;
        kind = 'heal';
      } else {
        const crit = rnd() < Math.min(0.4, me.luck / 200);
        amount = Math.max(1, Math.round(me.atk * (0.85 + 0.3 * rnd()) * (crit ? 1.5 : 1) - foe.def * 0.5));
        amount = Math.min(amount, foe.hp);
        foe.hp -= amount;
        if (crit) kind = 'crit';
      }
      rounds.push({ n, actor: who, kind, amount, hpA: side.a.hp, hpB: side.b.hp });
    }
  }
  const { a: A, b: B } = side;
  let winner = 'draw';
  if (A.hp <= 0 || B.hp <= 0) winner = A.hp > 0 ? 'a' : B.hp > 0 ? 'b' : 'draw';
  else if (A.hp / A.life !== B.hp / B.life) winner = A.hp / A.life > B.hp / B.life ? 'a' : 'b';
  return { winner, hpA: A.hp, hpB: B.hp, rounds };
}

function shuffle(list, rnd) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Weekly tournament: FIGHTS_PER_WEEK random pairings, win 3 / draw 1 / bye 2 points.
 * Pure and independent of object key order. Returns
 * {week, table:[{rank,username,points,wins,losses,draws,byes,power,charm}], featured:[match], beauty:[{username,charm}]}.
 */
export function runSeason(players, week) {
  const names = Object.keys(players).sort();
  const stats = Object.fromEntries(names.map((u) => [u, playerStats(players[u].inventory)]));
  const rec = Object.fromEntries(names.map((u) => [u, { username: u, points: 0, wins: 0, losses: 0, draws: 0, byes: 0, power: stats[u].power, charm: stats[u].charm }]));
  const fighterOf = (u) => ({ name: u, atk: stats[u].atk, def: stats[u].def, luck: stats[u].luck, life: stats[u].life, heal: stats[u].heal });
  const matches = [];
  for (let r = 0; r < FIGHTS_PER_WEEK; r++) {
    const order = shuffle(names, mulberry32(hashSeed(`pairs:${week}:${r}`)));
    for (let i = 0; i + 1 < order.length; i += 2) {
      const [x, y] = [order[i], order[i + 1]];
      const res = simulateBattle(fighterOf(x), fighterOf(y), `${week}:${r}:${x}:${y}`);
      if (res.winner === 'draw') {
        for (const u of [x, y]) { rec[u].draws++; rec[u].points += POINTS.draw; }
      } else {
        const [w, l] = res.winner === 'a' ? [x, y] : [y, x];
        rec[w].wins++; rec[w].points += POINTS.win; rec[l].losses++;
      }
      matches.push({ a: fighterOf(x), b: fighterOf(y), ...res, weight: stats[x].power + stats[y].power });
    }
    if (order.length % 2 === 1) {
      const u = order[order.length - 1];
      rec[u].byes++; rec[u].points += POINTS.bye;
    }
  }
  const table = Object.values(rec)
    .sort((p, q) => q.points - p.points || q.power - p.power || p.username.localeCompare(q.username))
    .map((row, i) => ({ rank: i + 1, ...row }));
  const featured = matches
    .sort((p, q) => q.weight - p.weight || p.a.name.localeCompare(q.a.name))
    .slice(0, FEATURED)
    .map(({ weight, ...m }) => m);
  const beauty = names
    .map((u) => ({ username: u, charm: stats[u].charm }))
    .sort((p, q) => q.charm - p.charm || p.username.localeCompare(q.username))
    .slice(0, BEAUTY_LIST);
  return { week, table, featured, beauty };
}

function givePrize(player, count, week, tag) {
  for (let i = 0; i < count; i++) {
    const seed = `${week}:${tag}:${i}`;
    for (const item of openChest('prize', seed)) player.inventory[item.id] = (player.inventory[item.id] ?? 0) + 1;
    player.chests.prize = (player.chests.prize ?? 0) + 1;
    player.log.push({ type: 'prize', seed, ts: 0 });
    if (player.log.length > 20) player.log.shift();
  }
}

/** Pure: hand out the week's prizes once. Re-applying the same week returns an equal state. */
export function applySeason(state, season) {
  if (state.lastSeason === season.week) return state;
  const s = structuredClone(state);
  season.table.slice(0, PRIZE_RANKS.length).forEach((row, i) => {
    if (Object.hasOwn(s.players, row.username)) givePrize(s.players[row.username], PRIZE_RANKS[i], season.week, `rank${row.rank}:${row.username}`);
  });
  season.beauty.slice(0, BEAUTY_PRIZES).forEach((row, i) => {
    if (row.charm > 0 && Object.hasOwn(s.players, row.username)) givePrize(s.players[row.username], 1, season.week, `beauty${i + 1}:${row.username}`);
  });
  s.lastSeason = season.week;
  return s;
}
