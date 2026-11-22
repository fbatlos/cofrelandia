import { hashSeed, mulberry32 } from './rng.mjs';
import loot from '../../data/loot.json' with { type: 'json' };

const KINDS = Object.keys(loot.items);

function weightedPick(table, rnd) {
  const entries = Object.entries(table);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r < 0) return key;
  }
  return entries[entries.length - 1][0];
}

/**
 * Open a chest deterministically.
 * @param {'welcome'|'common'|'event'} type
 * @param {string} seed usually the TikTok comment id
 * @returns {{id:string,name:string,kind:string,rarity:string}[]}
 */
export function openChest(type, seed) {
  if (!loot.tables[type]) throw new Error(`unknown chest type: ${type}`);
  const rnd = mulberry32(hashSeed(`${type}:${seed}`));
  const items = [];
  for (let i = 0; i < loot.counts[type]; i++) {
    const rarity = weightedPick(loot.tables[type], rnd);
    const kind = KINDS[Math.floor(rnd() * KINDS.length)];
    const names = loot.items[kind][rarity];
    const idx = Math.floor(rnd() * names.length);
    items.push({ id: `${kind}-${rarity}-${idx}`, name: names[idx], kind, rarity });
  }
  return items;
}
