import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemById, openChest, allItemIds } from '../src/core/loot.mjs';
import { bestLoadout, playerStats, BASE_LIFE } from '../src/core/equip.mjs';

test('catalog is large and every item has icon, stats and a rebuildable id', () => {
  const ids = allItemIds();
  assert.ok(ids.length >= 110, `only ${ids.length} items`);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    const it = itemById(id);
    assert.ok(it.icon && it.name, id);
    assert.ok(Object.keys(it.stats).length >= 1, id);
    for (const v of Object.values(it.stats)) assert.ok(Number.isInteger(v) && v > 0, id);
  }
});

test('higher rarity always beats lower rarity for the same kind', () => {
  const order = ['common', 'rare', 'epic', 'legendary'];
  const mainStat = { weapon: 'atk', armor: 'def', accessory: 'luck', consumable: 'heal', decor: 'charm' };
  for (const [kind, stat] of Object.entries(mainStat)) {
    const range = (r) => {
      const vals = allItemIds().filter((id) => id.startsWith(`${kind}-${r}-`)).map((id) => itemById(id).stats[stat] ?? 0);
      return [Math.min(...vals), Math.max(...vals)];
    };
    for (let i = 0; i < 3; i++) assert.ok(range(order[i])[1] < range(order[i + 1])[0], `${kind} ${order[i]}`);
  }
});

test('opened chest items carry stats and icon', () => {
  for (const it of openChest('event', 'stats')) {
    assert.ok(it.icon);
    assert.ok(it.stats);
  }
});

test('bestLoadout picks the strongest weapon, armor and two accessories', () => {
  const inv = {
    'weapon-common-0': 1, 'weapon-legendary-0': 1, 'weapon-rare-3': 1,
    'armor-epic-1': 1, 'armor-common-5': 1,
    'accessory-rare-0': 1, 'accessory-legendary-2': 1, 'accessory-epic-4': 1, 'accessory-common-1': 3,
    'consumable-legendary-0': 4, 'decor-legendary-0': 2,
  };
  const l = bestLoadout(inv);
  assert.deepEqual(l.weapon.map((i) => i.id), ['weapon-legendary-0']);
  assert.deepEqual(l.armor.map((i) => i.id), ['armor-epic-1']);
  assert.equal(l.accessory.length, 2);
  assert.ok(l.accessory.some((i) => i.id === 'accessory-legendary-2'));
});

test('empty inventory gives base stats and empty slots', () => {
  const s = playerStats({});
  assert.equal(s.life, BASE_LIFE);
  assert.equal(s.atk, 0);
  assert.equal(s.def, 0);
  assert.equal(s.luck, 0);
  assert.equal(s.charm, 0);
  assert.equal(s.power, 0);
  assert.deepEqual(bestLoadout({}).weapon, []);
});

test('equipped stats add up, decor charm and consumable heal sum over everything owned', () => {
  const inv = { 'weapon-rare-0': 1, 'armor-common-0': 1, 'decor-common-0': 3, 'decor-rare-1': 1, 'consumable-common-0': 2 };
  const w = itemById('weapon-rare-0').stats;
  const a = itemById('armor-common-0').stats;
  const s = playerStats(inv);
  assert.equal(s.atk, w.atk);
  assert.equal(s.def, a.def);
  assert.equal(s.life, BASE_LIFE + (a.hp ?? 0) + (w.hp ?? 0));
  assert.equal(s.charm, 3 * itemById('decor-common-0').stats.charm + itemById('decor-rare-1').stats.charm);
  assert.equal(s.heal, 2 * itemById('consumable-common-0').stats.heal);
  assert.ok(s.power > 0);
});

test('unknown or removed item ids in an old inventory are ignored', () => {
  const s = playerStats({ 'weapon-common-99': 2, 'bogus': 1, 'weapon-rare-0': 1 });
  assert.equal(s.atk, itemById('weapon-rare-0').stats.atk);
});

test('more or better gear never lowers power', () => {
  const base = playerStats({ 'weapon-common-0': 1 }).power;
  assert.ok(playerStats({ 'weapon-common-0': 1, 'armor-common-0': 1 }).power >= base);
  assert.ok(playerStats({ 'weapon-epic-0': 1 }).power > base);
});
