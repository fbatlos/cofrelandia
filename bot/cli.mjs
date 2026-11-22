import { readFile, writeFile } from 'node:fs/promises';
import { run } from './run.mjs';
import { fetchComments } from './fetch-comments.mjs';

const STATE = new URL('../data/state.json', import.meta.url);
const CONFIG = new URL('../config/videos.json', import.meta.url);

const { videos } = JSON.parse(await readFile(CONFIG, 'utf8'));
const result = await run({
  fetch: fetchComments,
  readState: async () => JSON.parse(await readFile(STATE, 'utf8')),
  writeState: (s) => writeFile(STATE, JSON.stringify(s, null, 1) + '\n'),
  videos,
});
console.log(JSON.stringify(result));
if (videos.length > 0 && result.failed === videos.length) process.exit(1);
