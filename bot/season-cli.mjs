import { readFile, writeFile } from 'node:fs/promises';
import { runWeekly } from './season.mjs';

const STATE = new URL('../data/state.json', import.meta.url);
const SEASON = new URL('../data/season.json', import.meta.url);
const readJson = async (url, fallback) => {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
};

const result = await runWeekly({
  readState: () => readJson(STATE),
  readSeason: () => readJson(SEASON, { history: [] }),
  writeState: (s) => writeFile(STATE, JSON.stringify(s, null, 1) + '\n'),
  writeSeason: (s) => writeFile(SEASON, JSON.stringify(s) + '\n'),
});
console.log(JSON.stringify(result));
