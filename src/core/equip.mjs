import { itemById } from './loot.mjs';

export const BASE_LIFE = 100;

/** Equipment slots: the best items of each kind are equipped automatically (the static site cannot save choices). */
export const SLOTS = [
  { slot: 'weapon', kind: 'weapon', size: 1, label: 'Arma', icon: '⚔️' },
  { slot: 'armor', kind: 'armor', size: 1, label: 'Armadura', icon: '🛡️' },
  { slot: 'accessory', kind: 'accessory', size: 2, label: 'Accesorio', icon: '💍' },
];

/** Single number used to rank items of the same kind. */
export function score(item) {
  const s = item.stats;
  return (s.atk ?? 0) * 2 + (s.def ?? 0) * 1.5 + (s.hp ?? 0) / 5 + (s.luck ?? 0) * 1.2;
}

/** Owned items as [{...item, n}], skipping ids that no longer exist in the catalog. */
export function ownedItems(inventory) {
  const out = [];
  for (const [id, n] of Object.entries(inventory)) {
    try {
      out.push({ ...itemById(id), n });
    } catch {
      // Old or removed item id: ignore it instead of breaking the whole profile.
    }
  }
  return out;
}

/** Best item(s) per slot: {weapon: Item[], armor: Item[], accessory: Item[]}. */
export function bestLoadout(inventory) {
  const owned = ownedItems(inventory);
  const loadout = {};
  for (const { slot, kind, size } of SLOTS) {
    loadout[slot] = owned
      .filter((it) => it.kind === kind)
      .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
      .slice(0, size);
  }
  return loadout;
}

/**
 * Totals for a player: equipped atk/def/luck/hp, charm summed over all decor owned,
 * heal summed over all consumables owned, and a single combat power.
 */
export function playerStats(inventory) {
  const owned = ownedItems(inventory);
  const loadout = bestLoadout(inventory);
  const sum = { atk: 0, def: 0, luck: 0, hp: 0 };
  for (const it of Object.values(loadout).flat()) for (const k of Object.keys(sum)) sum[k] += it.stats[k] ?? 0;
  const total = (kind, stat) => owned.filter((it) => it.kind === kind).reduce((a, it) => a + it.n * (it.stats[stat] ?? 0), 0);
  const life = BASE_LIFE + sum.hp;
  const power = Math.round(sum.atk * 2 + sum.def * 1.5 + sum.hp / 5 + sum.luck);
  return { atk: sum.atk, def: sum.def, luck: sum.luck, life, charm: total('decor', 'charm'), heal: total('consumable', 'heal'), power, loadout };
}
