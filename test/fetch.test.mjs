import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchComments, mapComment } from '../bot/fetch-comments.mjs';

test('mapComment returns null for comments without id or with bad timestamp', () => {
  assert.equal(mapComment({ text: 'x', create_time: 1, user: { unique_id: 'a' } }), null);
  assert.equal(mapComment({ id: '1', text: 'x', create_time: 'abc', user: { unique_id: 'a' } }), null);
  assert.equal(mapComment({ id: '1', text: 'x', create_time: 5, user: {} }), null);
  assert.deepEqual(mapComment({ id: 1, text: 'x', create_time: 5, user: { unique_id: 'A' } }), { id: '1', username: 'a', text: 'x', ts: 5000 });
});

test('fetchComments drops malformed rows and stops when cursor is missing', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({ code: 0, data: { hasMore: true, comments: [{ text: 'no id', create_time: 1, user: { unique_id: 'a' } }, { id: '9', text: 'ok', create_time: 2, user: { unique_id: 'b' } }] } }),
    };
  };
  const out = await fetchComments('https://x', { fetchImpl, delayMs: 0 });
  assert.equal(calls, 1);
  assert.deepEqual(out.map((c) => c.id), ['9']);
});
