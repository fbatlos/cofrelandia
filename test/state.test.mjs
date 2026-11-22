import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeFor, normalizeText } from '../src/core/code.mjs';
import { emptyState, processComments, DAILY_CHEST_CAP } from '../src/core/state.mjs';

const DAY = Date.UTC(2026, 10, 22, 12);
let n = 0;
const c = (username, text, ts = DAY) => ({ id: `c${++n}`, username, text, ts });
const total = (inv) => Object.values(inv).reduce((a, b) => a + b, 0);

test('codeFor has the CASA-XXX format and is stable', () => {
  assert.match(codeFor('maria'), /^CASA-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}$/);
  assert.equal(codeFor('maria'), codeFor('MARIA'));
});

test('normalizeText strips case, spaces and emoji', () => {
  assert.equal(normalizeText(' casa-7k2 🔥 '), 'CASA7K2');
});

test('code in any case/spacing/emoji registers the commenter', () => {
  const code = codeFor('maria');
  for (const text of [code, code.toLowerCase(), ` ${code} 🔥`, `mi codigo ${code} jeje`]) {
    const s = processComments(emptyState(), [c('maria', text)], DAY);
    const p = s.players.maria;
    assert.ok(p, text);
    assert.equal(p.life, 100);
    assert.equal(p.chests.welcome, 1);
    assert.ok(total(p.inventory) >= 1);
    assert.deepEqual(p.house.x, 0);
  }
});

test("commenting someone else's code does not register them", () => {
  assert.notEqual(codeFor('maria'), codeFor('pepe'));
  const s = processComments(emptyState(), [c('pepe', codeFor('maria'))], DAY);
  assert.deepEqual(s.players, {});
});

test('comment from an unregistered user without a code changes nothing', () => {
  const s = processComments(emptyState(), [c('ana', 'hola')], DAY);
  assert.deepEqual(s.players, {});
});

test('same comment id processed twice grants one chest', () => {
  const reg = c('maria', codeFor('maria'));
  const com = c('maria', 'hola', DAY + 1000);
  let s = processComments(emptyState(), [reg, com], DAY);
  s = processComments(s, [reg, com], DAY);
  assert.equal(s.players.maria.chests.common, 1);
});

test('daily cap and rollover', () => {
  const list = [c('maria', codeFor('maria'))];
  for (let i = 1; i <= DAILY_CHEST_CAP + 1; i++) list.push(c('maria', `x${i}`, DAY + i * 1000));
  let s = processComments(emptyState(), list, DAY);
  assert.equal(s.players.maria.chests.common, DAILY_CHEST_CAP);
  s = processComments(s, [c('maria', 'otro dia', DAY + 86400000)], DAY);
  assert.equal(s.players.maria.chests.common, DAILY_CHEST_CAP + 1);
});

test('comments older than joining are ignored', () => {
  const s = processComments(emptyState(), [c('maria', 'viejo', DAY - 5000), c('maria', codeFor('maria'), DAY)], DAY);
  assert.equal(s.players.maria.chests.common, 0);
});

test('event code grants one event chest per player per code', () => {
  let s = emptyState();
  s.events['REGALO-1'] = 'Video especial';
  s = processComments(s, [c('maria', codeFor('maria')), c('maria', 'regalo-1', DAY + 1000), c('maria', 'REGALO-1 😍', DAY + 2000)], DAY);
  assert.equal(s.players.maria.chests.event, 1);
});

test('houses never overlap', () => {
  const list = ['a', 'b', 'c', 'd', 'e'].map((u, i) => c(u, codeFor(u), DAY + i));
  const s = processComments(emptyState(), list, DAY);
  const pos = Object.values(s.players).map((p) => `${p.house.x},${p.house.z}`);
  assert.equal(new Set(pos).size, 5);
});

test('usernames that collide with Object.prototype are handled safely', () => {
  for (const u of ['constructor', '__proto__', 'toString']) {
    const s = processComments(emptyState(), [c(u, codeFor(u)), c(u, 'hola', DAY + 1000)], DAY);
    assert.ok(Object.hasOwn(s.players, u), u);
    assert.equal(s.players[u].chests.common, 1, u);
    assert.equal({}.chests, undefined);
  }
  const s = processComments(emptyState(), [c('constructor', 'sin codigo')], DAY);
  assert.deepEqual(Object.keys(s.players), []);
});

test('comment ids stay deduplicated after many other comments (no count-based eviction)', () => {
  const reg = c('maria', codeFor('maria'), DAY);
  const target = c('maria', 'hola', DAY + 1);
  let s = processComments(emptyState(), [reg, target], DAY);
  const noise = Array.from({ length: 6000 }, (_, i) => c('maria', `n${i}`, DAY + 2 + i));
  s = processComments(s, noise, DAY + 100000);
  const before = s.players.maria.chests.common;
  s = processComments(s, [target], DAY + 100000);
  assert.equal(s.players.maria.chests.common, before);
});

test('a late comment from a previous day does not reset the daily counter', () => {
  const day0 = DAY - 2 * 86400000;
  let s = processComments(emptyState(), [c('maria', codeFor('maria'), day0)], DAY);
  const today = Array.from({ length: DAILY_CHEST_CAP }, (_, i) => c('maria', 'hoy', DAY + i));
  s = processComments(s, today, DAY);
  s = processComments(s, [c('maria', 'tarde', DAY - 86400000)], DAY);
  s = processComments(s, [c('maria', 'extra', DAY + 5000)], DAY);
  assert.equal(s.players.maria.chests.common, DAILY_CHEST_CAP);
});

test('codes with spaces or dashes of any kind still register', () => {
  const raw = codeFor('maria'); // CASA-XXX
  const x = raw.slice(5);
  for (const text of [`CASA ${x}`, `casa–${x}`, `casa — ${x}`, `Casa_${x}`]) {
    const s = processComments(emptyState(), [c('maria', text)], DAY);
    assert.ok(s.players.maria, text);
  }
});
