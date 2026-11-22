import { hashSeed } from './rng.mjs';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Registration code a player must comment, e.g. CASA-7K2. Not secret: identity is the commenter. */
export function codeFor(username) {
  let h = hashSeed(`pueblo:${String(username).toLowerCase()}`);
  let out = '';
  for (let i = 0; i < 3; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length);
  }
  return `CASA-${out}`;
}

/** Uppercase and keep only A-Z, 0-9 and "-" so case, spaces and emoji never break a match. */
export function normalizeText(text) {
  return String(text ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '');
}
