import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWeekly, TABLE_LIMIT, HISTORY_LIMIT } from '../bot/season.mjs';
import { emptyState, processComments } from '../src/core/state.mjs';
import { codeFor } from '../src/core/code.mjs';

const NOW = Date.UTC(2026, 10, 22, 20);

function town(n) {
  const comments = Array.from({ length: n }, (_, i) => ({ id: `r${i}`, username: `u${i}`, text: codeFor(`u${i}`), ts: NOW - 10 ** 8 + i }));
  return processComments(emptyState(), comments, NOW - 10 ** 7);
}

function harness(state, season = { history: [] }) {
  const out = { state: null, season: null, writes: 0 };
  return {
    out,
    deps: {
      readState: async () => state,
      readSeason: async () => season,
      writeState: async (s) => { out.state = s; out.writes++; },
      writeSeason: async (s) => { out.season = s; out.writes++; },
      now: NOW,
    },
  };
}

test('runs the weekly battle once and records prizes, season and history', async () => {
  const h = harness(town(12));
  const r = await runWeekly(h.deps);
  assert.equal(r.skipped, undefined);
  assert.equal(r.week, '2026-W47');
  assert.equal(h.out.state.lastSeason, '2026-W47');
  assert.equal(h.out.season.week, '2026-W47');
  assert.equal(h.out.season.table.length, 12);
  assert.equal(h.out.season.history.length, 1);
  assert.equal(h.out.season.history[0].week, '2026-W47');
  assert.ok(h.out.season.history[0].champion);
});

test('a second run in the same week does nothing', async () => {
  const first = harness(town(12));
  await runWeekly(first.deps);
  const second = harness(first.out.state, first.out.season);
  const r = await runWeekly(second.deps);
  assert.equal(r.skipped, 'already-ran');
  assert.equal(second.out.writes, 0);
});

test('an empty town is skipped without writing', async () => {
  const h = harness(emptyState());
  const r = await runWeekly(h.deps);
  assert.equal(r.skipped, 'no-players');
  assert.equal(h.out.writes, 0);
});

test('table and history are capped', async () => {
  const old = Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => ({ week: `old${i}`, champion: 'x', players: 1 }));
  const h = harness(town(TABLE_LIMIT + 30), { history: old });
  await runWeekly(h.deps);
  assert.equal(h.out.season.table.length, TABLE_LIMIT);
  assert.equal(h.out.season.history.length, HISTORY_LIMIT);
  assert.equal(h.out.season.history.at(-1).week, '2026-W47');
  assert.equal(h.out.season.players, TABLE_LIMIT + 30);
});
