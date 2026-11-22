import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../bot/run.mjs';
import { emptyState } from '../src/core/state.mjs';
import { codeFor } from '../src/core/code.mjs';

const TS = Date.UTC(2026, 10, 22, 12);
const comments = {
  v1: [{ id: 'a1', username: 'maria', text: codeFor('maria'), ts: TS }],
  v2: [{ id: 'b1', username: 'pepe', text: codeFor('pepe'), ts: TS + 1 }],
};

function harness(fetchImpl) {
  const writes = [];
  return {
    writes,
    deps: {
      fetch: fetchImpl,
      readState: async () => emptyState(),
      writeState: async (s) => writes.push(s),
      videos: ['v1', 'v2'],
      now: TS,
    },
  };
}

test('processes all videos and writes state once', async () => {
  const h = harness(async (v) => comments[v]);
  const r = await run(h.deps);
  assert.equal(h.writes.length, 1);
  assert.deepEqual(Object.keys(h.writes[0].players).sort(), ['maria', 'pepe']);
  assert.equal(r.newChests, 2);
  assert.equal(r.failed, 0);
});

test('a failing video does not abort the others', async () => {
  const h = harness(async (v) => {
    if (v === 'v1') throw new Error('boom');
    return comments[v];
  });
  const r = await run(h.deps);
  assert.deepEqual(Object.keys(h.writes[0].players), ['pepe']);
  assert.equal(r.failed, 1);
});

test('when every video fails, nothing is written', async () => {
  const h = harness(async () => {
    throw new Error('down');
  });
  const r = await run(h.deps);
  assert.equal(h.writes.length, 0);
  assert.equal(r.failed, 2);
});
