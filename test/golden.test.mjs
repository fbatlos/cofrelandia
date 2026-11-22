import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openChest, itemById } from '../src/core/loot.mjs';

// Pins determinism across environments: browser replays must match what the bot granted.
test('golden chest for a known seed', () => {
  assert.deepEqual(openChest('welcome', 'known').map((i) => i.id), ['armor-rare-2', 'accessory-rare-4', 'armor-rare-2']);
});

test('itemById round-trips every opened item', () => {
  for (const it of openChest('event', 'rt')) assert.deepEqual(itemById(it.id), it);
});

test('itemById rejects unknown ids', () => {
  assert.throws(() => itemById('weapon-common-99'));
});
