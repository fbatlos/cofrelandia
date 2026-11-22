// Usage: node scripts/fake-state.mjs 1500 > web/demo-state.json
import { emptyState, processComments } from '../src/core/state.mjs';
import { codeFor } from '../src/core/code.mjs';

const n = Number(process.argv[2] ?? 100);
const base = Date.UTC(2026, 10, 1);
const comments = [];
for (let i = 0; i < n; i++) {
  const u = `user${i}`;
  comments.push({ id: `r${i}`, username: u, text: codeFor(u), ts: base + i });
  for (let k = 0; k < i % 4; k++) comments.push({ id: `c${i}-${k}`, username: u, text: 'hola', ts: base + n + i * 10 + k });
}
console.log(JSON.stringify(processComments(emptyState(), comments, base)));
