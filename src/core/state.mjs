import { hashSeed } from './rng.mjs';
import { openChest } from './loot.mjs';
import { codeFor, normalizeText } from './code.mjs';

export const DAILY_CHEST_CAP = 10;
export const MAX_COMMENT_AGE_MS = 30 * 86400000;
const LOG_LIMIT = 20;

/**
 * State = {
 *   players: Record<username, {house:{x,z,seed}, life, inventory:Record<itemId,count>,
 *     chests:{welcome,common,event}, daily:{day,n}, joinedAt, claimedEvents:string[],
 *     log:{type,seed,ts}[]}>,
 *   seen: Record<commentId, ts>, // comments that had an effect; pruned after MAX_COMMENT_AGE_MS
 *   events: Record<code,label>   // event codes (normalized when matched)
 * }
 * Player lookups use Object.hasOwn: usernames such as "constructor" or "__proto__" are valid on TikTok.
 */
export function emptyState() {
  return { players: {}, seen: {}, events: {} };
}

/** n-th cell of a square spiral starting at (0,0). */
function spiral(n) {
  let x = 0, z = 0, dx = 0, dz = -1;
  for (let i = 0; i < n; i++) {
    if (x === z || (x < 0 && x === -z) || (x > 0 && x === 1 - z)) [dx, dz] = [-dz, dx];
    x += dx;
    z += dz;
  }
  return { x, z };
}

function grant(player, type, seed, ts) {
  for (const item of openChest(type, seed)) player.inventory[item.id] = (player.inventory[item.id] ?? 0) + 1;
  player.chests[type]++;
  player.log.push({ type, seed, ts });
  if (player.log.length > LOG_LIMIT) player.log.shift();
}

/** Pure: returns a new state; each effectful comment id is processed at most once. */
export function processComments(state, comments, now = Date.now()) {
  const s = structuredClone(state);
  const minTs = now - MAX_COMMENT_AGE_MS;
  for (const [id, ts] of Object.entries(s.seen)) if (ts < minTs) delete s.seen[id];
  const ordered = [...comments].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  for (const cm of ordered) {
    if (!Number.isFinite(cm.ts) || cm.ts < minTs || Object.hasOwn(s.seen, cm.id)) continue;
    const text = normalizeText(cm.text);
    let player = Object.hasOwn(s.players, cm.username) ? s.players[cm.username] : undefined;
    if (!player) {
      if (!text.includes(normalizeText(codeFor(cm.username)))) continue;
      player = {
        house: { ...spiral(Object.keys(s.players).length), seed: hashSeed(cm.username) },
        life: 100,
        inventory: {},
        chests: { welcome: 0, common: 0, event: 0 },
        daily: { day: '', n: 0 },
        joinedAt: cm.ts,
        claimedEvents: [],
        log: [],
      };
      Object.defineProperty(s.players, cm.username, { value: player, enumerable: true, writable: true, configurable: true });
      s.seen[cm.id] = cm.ts;
      grant(player, 'welcome', cm.id, cm.ts);
      continue;
    }
    if (cm.ts <= player.joinedAt) continue;
    for (const code of Object.keys(s.events)) {
      if (text.includes(normalizeText(code)) && !player.claimedEvents.includes(code)) {
        player.claimedEvents.push(code);
        s.seen[cm.id] = cm.ts;
        grant(player, 'event', `${cm.id}:${code}`, cm.ts);
      }
    }
    const day = new Date(cm.ts).toISOString().slice(0, 10);
    if (day < player.daily.day) continue; // late comment from a past day: never reopens that day's cap
    if (day > player.daily.day) player.daily = { day, n: 0 };
    if (player.daily.n < DAILY_CHEST_CAP) {
      player.daily.n++;
      s.seen[cm.id] = cm.ts;
      grant(player, 'common', cm.id, cm.ts);
    }
  }
  return s;
}
