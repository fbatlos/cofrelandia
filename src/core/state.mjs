import { hashSeed } from './rng.mjs';
import { openChest } from './loot.mjs';
import { codeFor, normalizeText } from './code.mjs';

export const DAILY_CHEST_CAP = 10;
const SEEN_LIMIT = 5000;
const LOG_LIMIT = 20;

/**
 * State = {
 *   players: Record<username, {house:{x,z,seed}, life, inventory:Record<itemId,count>,
 *     chests:{welcome,common,event}, daily:{day,n}, joinedAt, claimedEvents:string[],
 *     log:{type,seed,ts}[]}>,
 *   seen: string[],            // processed comment ids (capped)
 *   events: Record<code,label> // normalized event codes
 * }
 */
export function emptyState() {
  return { players: {}, seen: [], events: {} };
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

/** Pure: returns a new state; each comment id is processed at most once. */
export function processComments(state, comments, now = Date.now()) {
  const s = structuredClone(state);
  const seen = new Set(s.seen);
  const ordered = [...comments].sort((a, b) => a.ts - b.ts || a.id.localeCompare(b.id));
  for (const cm of ordered) {
    if (seen.has(cm.id)) continue;
    seen.add(cm.id);
    s.seen.push(cm.id);
    const text = normalizeText(cm.text);
    let player = s.players[cm.username];
    if (!player) {
      if (!text.includes(codeFor(cm.username))) continue;
      const idx = Object.keys(s.players).length;
      player = s.players[cm.username] = {
        house: { ...spiral(idx), seed: hashSeed(cm.username) },
        life: 100,
        inventory: {},
        chests: { welcome: 0, common: 0, event: 0 },
        daily: { day: '', n: 0 },
        joinedAt: cm.ts,
        claimedEvents: [],
        log: [],
      };
      grant(player, 'welcome', cm.id, cm.ts);
      continue;
    }
    if (cm.ts <= player.joinedAt) continue;
    for (const [code] of Object.entries(s.events)) {
      if (text.includes(code) && !player.claimedEvents.includes(code)) {
        player.claimedEvents.push(code);
        grant(player, 'event', `${cm.id}:${code}`, cm.ts);
      }
    }
    const day = new Date(cm.ts).toISOString().slice(0, 10);
    if (player.daily.day !== day) player.daily = { day, n: 0 };
    if (player.daily.n < DAILY_CHEST_CAP) {
      player.daily.n++;
      grant(player, 'common', cm.id, cm.ts);
    }
  }
  if (s.seen.length > SEEN_LIMIT) s.seen = s.seen.slice(-SEEN_LIMIT);
  return s;
}
