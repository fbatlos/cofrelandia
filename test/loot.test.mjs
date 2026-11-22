import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openChest } from '../src/core/loot.mjs';
import loot from '../data/loot.json' with { type: 'json' };

const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };

test('same seed gives the same chest', () => {
  assert.deepEqual(openChest('common', 'abc'), openChest('common', 'abc'));
});

test('different seeds give different chests', () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) seen.add(JSON.stringify(openChest('welcome', `s${i}`)));
  assert.ok(seen.size > 25);
});

test('welcome chest always has rare or better items', () => {
  for (let i = 0; i < 200; i++) {
    const items = openChest('welcome', `w${i}`);
    assert.ok(items.length >= 1);
    for (const it of items) assert.ok(RANK[it.rarity] >= 1);
  }
});

test('common chest rarity frequencies match the table within 3 points', () => {
  const counts = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const N = 10000;
  for (let i = 0; i < N; i++) counts[openChest('common', `f${i}`)[0].rarity]++;
  const total = Object.values(loot.tables.common).reduce((a, b) => a + b, 0);
  for (const [r, w] of Object.entries(loot.tables.common)) {
    assert.ok(Math.abs((counts[r] / N) * 100 - (w / total) * 100) <= 3, r);
  }
});

test('items have the documented shape', () => {
  const it = openChest('event', 'x')[0];
  assert.ok(it.id && it.name);
  assert.ok(['weapon', 'armor', 'consumable', 'decor'].includes(it.kind));
});
