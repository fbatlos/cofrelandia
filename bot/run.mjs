import { processComments } from '../src/core/state.mjs';

const countChests = (state) =>
  Object.values(state.players).reduce((n, p) => n + p.chests.welcome + p.chests.common + p.chests.event, 0);

/**
 * Fetch comments of every video, apply them to the state and persist it once.
 * A failing video is skipped; if all fail, nothing is written.
 */
export async function run({ fetch, readState, writeState, videos, now = Date.now() }) {
  const before = await readState();
  const all = [];
  let failed = 0;
  for (const url of videos) {
    try {
      all.push(...(await fetch(url)));
    } catch (err) {
      failed++;
      console.error(`video failed: ${url}: ${err.message}`);
    }
  }
  if (videos.length > 0 && failed === videos.length) return { newChests: 0, failed };
  const after = processComments(before, all, now);
  await writeState(after);
  return { newChests: countChests(after) - countChests(before), failed };
}
