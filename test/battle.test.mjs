import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateBattle, runSeason, applySeason, weekId, MAX_ROUNDS, PRIZE_RANKS } from '../src/core/battle.mjs';
import { openChest } from '../src/core/loot.mjs';
import { emptyState, processComments } from '../src/core/state.mjs';
import { codeFor } from '../src/core/code.mjs';

const fighter = (name, o = {}) => ({ name, atk: 10, def: 0, luck: 0, life: 100, heal: 0, ...o });

test('weekId follows ISO weeks, including year boundaries', () => {
  assert.equal(weekId(Date.UTC(2026, 10, 22)), '2026-W47'); // Sunday
  assert.equal(weekId(Date.UTC(2026, 10, 23)), '2026-W48'); // Monday
  assert.equal(weekId(Date.UTC(2021, 0, 3)), '2020-W53');
  assert.equal(weekId(Date.UTC(2024, 11, 30)), '2025-W01');
});

test('simulateBattle is deterministic for the same seed', () => {
  const a = fighter('a', { atk: 30, luck: 20 });
  const b = fighter('b', { def: 10, heal: 40 });
  assert.deepEqual(simulateBattle(a, b, 's1'), simulateBattle(a, b, 's1'));
});

test('a clearly stronger fighter wins every time', () => {
  const strong = fighter('s', { atk: 60, def: 20, life: 200 });
  const weak = fighter('w', { atk: 5 });
  for (let i = 0; i < 200; i++) {
    assert.equal(simulateBattle(strong, weak, `k${i}`).winner, 'a', `seed ${i}`);
    assert.equal(simulateBattle(weak, strong, `k${i}`).winner, 'b', `seed ${i}`);
  }
});

test('log is bounded, hp never negative and the loser reaches 0 when not timed out', () => {
  for (let i = 0; i < 100; i++) {
    const r = simulateBattle(fighter('a', { atk: 25 }), fighter('b', { atk: 22, life: 90 }), `l${i}`);
    assert.ok(r.rounds.length <= MAX_ROUNDS * 2);
    for (const step of r.rounds) assert.ok(step.hpA >= 0 && step.hpB >= 0);
    if (r.rounds.length < MAX_ROUNDS * 2) assert.ok(r.hpA === 0 || r.hpB === 0);
    assert.ok(['a', 'b', 'draw'].includes(r.winner));
  }
});

test('identical fighters with no attack stat draw on timeout', () => {
  const r = simulateBattle(fighter('a', { atk: 0 }), fighter('b', { atk: 0 }), 'draw');
  assert.equal(r.winner, 'draw');
});

test('heal is used at most once per fighter', () => {
  for (let i = 0; i < 100; i++) {
    const r = simulateBattle(fighter('a', { atk: 20, heal: 50 }), fighter('b', { atk: 20, heal: 50 }), `h${i}`);
    for (const who of ['a', 'b']) assert.ok(r.rounds.filter((s) => s.actor === who && s.kind === 'heal').length <= 1);
  }
});

function townState(n, withGear = true) {
  const base = Date.UTC(2026, 10, 1);
  const comments = [];
  for (let i = 0; i < n; i++) {
    const u = `user${i}`;
    comments.push({ id: `r${i}`, username: u, text: codeFor(u), ts: base + i });
    if (withGear) for (let k = 0; k < i % 6; k++) comments.push({ id: `c${i}-${k}`, username: u, text: 'x', ts: base + 1000 + i * 10 + k });
  }
  return processComments(emptyState(), comments, base + 10 ** 7);
}

test('runSeason builds a consistent ranked table', () => {
  const s = runSeason(townState(25).players, '2026-W48');
  assert.equal(s.week, '2026-W48');
  assert.equal(s.table.length, 25);
  assert.deepEqual(s.table.map((r) => r.rank), Array.from({ length: 25 }, (_, i) => i + 1));
  for (let i = 1; i < s.table.length; i++) assert.ok(s.table[i - 1].points >= s.table[i].points);
  const wins = s.table.reduce((a, r) => a + r.wins, 0);
  const losses = s.table.reduce((a, r) => a + r.losses, 0);
  assert.equal(wins, losses);
  assert.ok(s.table.every((r) => r.wins + r.losses + r.draws + r.byes === 3));
  assert.ok(s.featured.length >= 1 && s.featured.length <= 3);
  assert.ok(s.beauty.length <= 10);
});

test('runSeason does not depend on player insertion order', () => {
  const players = townState(15).players;
  const reversed = Object.fromEntries(Object.entries(players).reverse());
  assert.deepEqual(runSeason(players, 'w'), runSeason(reversed, 'w'));
});

test('odd player counts give exactly one bye per round, tiny towns do not crash', () => {
  const s = runSeason(townState(7).players, 'w');
  assert.equal(s.table.reduce((a, r) => a + r.byes, 0), 3);
  assert.equal(runSeason({}, 'w').table.length, 0);
  const solo = runSeason(townState(1).players, 'w');
  assert.equal(solo.table[0].byes, 3);
  assert.deepEqual(solo.featured, []);
});

test('a different week reshuffles the pairings', () => {
  const players = townState(30).players;
  assert.notDeepEqual(runSeason(players, 'A').table.map((r) => r.username), runSeason(players, 'B').table.map((r) => r.username));
});

test('prize chest is epic or better and has three items', () => {
  const items = openChest('prize', 'x');
  assert.equal(items.length, 3);
  assert.ok(items.every((i) => i.rarity === 'epic' || i.rarity === 'legendary'));
});

test('applySeason grants prize chests to the top ranks, once per week', () => {
  const state = townState(30);
  const season = runSeason(state.players, '2026-W48');
  const after = applySeason(state, season);
  const winners = season.table.slice(0, PRIZE_RANKS.length).map((r) => r.username);
  for (const u of winners) assert.ok(after.players[u].chests.prize >= 1, u);
  const last = season.table[season.table.length - 1].username;
  assert.ok(!after.players[last].chests.prize);
  assert.equal(after.lastSeason, '2026-W48');
  assert.deepEqual(applySeason(after, season), after);
  const nextWeek = applySeason(after, { ...season, week: '2026-W49' });
  assert.ok(nextWeek.players[winners[0]].chests.prize > after.players[winners[0]].chests.prize);
});

test('applySeason works for a town smaller than the prize list and for empty towns', () => {
  const small = townState(3);
  const out = applySeason(small, runSeason(small.players, 'w'));
  assert.equal(Object.keys(out.players).length, 3);
  const empty = applySeason(emptyState(), runSeason({}, 'w'));
  assert.equal(empty.lastSeason, 'w');
});

test('players named like Object.prototype members take part in the season and win prizes', () => {
  const base = Date.UTC(2026, 10, 1);
  const names = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'zed'];
  const comments = names.map((u, i) => ({ id: `p${i}`, username: u, text: codeFor(u), ts: base + i }));
  const state = processComments(emptyState(), comments, base + 10 ** 7);
  const season = runSeason(state.players, 'w');
  assert.equal(season.table.length, names.length);
  assert.deepEqual(season.table.map((r) => r.username).sort(), [...names].sort());
  const after = applySeason(state, season);
  for (const row of season.table.slice(0, PRIZE_RANKS.length)) assert.ok(Object.hasOwn(after.players, row.username));
  assert.ok(Object.values(after.players).every((p) => p.inventory && p.chests));
});
