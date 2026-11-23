import { runSeason, applySeason, weekId } from '../src/core/battle.mjs';

export const TABLE_LIMIT = 500;
export const HISTORY_LIMIT = 12;

/**
 * Run the weekly battle once: compute the ranking, hand out prizes in state, publish season data.
 * Idempotent per ISO week (state.lastSeason). Dependencies are injected for testing.
 */
export async function runWeekly({ readState, readSeason, writeState, writeSeason, now = Date.now() }) {
  const week = weekId(now);
  const state = await readState();
  if (state.lastSeason === week) return { skipped: 'already-ran', week };
  if (Object.keys(state.players).length === 0) return { skipped: 'no-players', week };
  const season = runSeason(state.players, week);
  const after = applySeason(state, season);
  const previous = await readSeason();
  const history = [
    ...(previous.history ?? []),
    { week, champion: season.table[0].username, beauty: season.beauty[0]?.username ?? null, players: season.table.length },
  ].slice(-HISTORY_LIMIT);
  await writeState(after);
  await writeSeason({ ...season, players: season.table.length, table: season.table.slice(0, TABLE_LIMIT), history });
  return { week, players: season.table.length, champion: season.table[0].username };
}
