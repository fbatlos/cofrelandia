import { hashSeed, mulberry32 } from './rng.mjs';
import loot from '../../data/loot.json' with { type: 'json' };

const POWER = { common: 1, rare: 2.2, epic: 4.5, legendary: 9 };

/**
 * Stats are derived from kind + rarity + index, never stored: the catalog stays small and
 * rebalancing here updates every existing inventory. Ranges of consecutive rarities never overlap.
 */
export function statsOf(kind, rarity, idx) {
  const P = POWER[rarity];
  const r = Math.round;
  const odd = idx % 2 === 1;
  switch (kind) {
    case 'weapon':
      return { atk: r(5 * P + idx * P * 0.4), ...(odd ? { luck: r(P) } : {}) };
    case 'armor':
      return { def: r(4 * P + idx * P * 0.3), hp: r(10 * P + idx * P) };
    case 'accessory':
      return { luck: r(3 * P + idx * P * 0.3), ...(odd ? { atk: r(P) } : { hp: r(5 * P) }) };
    case 'consumable':
      return { heal: r(15 * P + idx * 3 * P) };
    case 'decor':
      return { charm: r(3 * P + idx * P * 0.5) };
    default:
      throw new Error(`unknown kind: ${kind}`);
  }
}

function build(kind, rarity, idx) {
  const entry = loot.items[kind]?.[rarity]?.[idx];
  if (!entry) return null;
  return { id: `${kind}-${rarity}-${idx}`, name: entry[0], icon: entry[1], kind, rarity, stats: statsOf(kind, rarity, idx) };
}

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
 * @returns {{id:string,name:string,icon:string,kind:string,rarity:string,stats:Record<string,number>}[]}
 */
export function openChest(type, seed) {
  if (!loot.tables[type]) throw new Error(`unknown chest type: ${type}`);
  const rnd = mulberry32(hashSeed(`${type}:${seed}`));
  const items = [];
  for (let i = 0; i < loot.counts[type]; i++) {
    const rarity = weightedPick(loot.tables[type], rnd);
    const kind = weightedPick(loot.kindWeights, rnd);
    const idx = Math.floor(rnd() * loot.items[kind][rarity].length);
    items.push(build(kind, rarity, idx));
  }
  return items;
}

/** Rebuild an item from its id (`kind-rarity-index`), so inventories can store only ids. */
export function itemById(id) {
  const [kind, rarity, idx] = String(id).split('-');
  const item = build(kind, rarity, Number(idx));
  if (!item) throw new Error(`unknown item id: ${id}`);
  return item;
}

/** Every item id in the catalog. */
export function allItemIds() {
  return Object.entries(loot.items).flatMap(([kind, byRarity]) =>
    Object.entries(byRarity).flatMap(([rarity, list]) => list.map((_, i) => `${kind}-${rarity}-${i}`)),
  );
}
