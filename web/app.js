import { createWorld } from './map.js';
import { mountUi } from './ui.js';
import { emptyState, processComments } from '../src/core/state.mjs';
import { codeFor } from '../src/core/code.mjs';

const params = new URLSearchParams(location.search);
const DAY = 86400000;
const world = createWorld(document.getElementById('world'));
let state;
let demo = null;

if (params.has('demo')) {
  // Demo mode: everything runs in the browser; nothing is written anywhere.
  let clock = 0;
  let counter = 0;
  const total = () => Object.values(state.players.prueba.chests).reduce((a, b) => a + b, 0);

  const build = () => {
    clock = Date.now() - 3 * DAY;
    counter = 0;
    const comments = [];
    for (let i = 1; i <= 60; i++) {
      const u = `vecino${i}`;
      comments.push({ id: `seed-${u}`, username: u, text: codeFor(u), ts: clock + i * 1000 });
      for (let k = 0; k < i % 5; k++) comments.push({ id: `seed-${u}-${k}`, username: u, text: 'hola', ts: clock + 100000 + i * 100 + k });
    }
    comments.push({ id: 'seed-prueba', username: 'prueba', text: codeFor('prueba'), ts: clock + 70000 });
    state = emptyState();
    state.events.DEMO = 'Cofre de evento de prueba';
    clock += 200000;
    state = processComments(state, comments, clock);
    world.setPlayers(state.players);
  };

  const say = (text, okMsg) => {
    const before = total();
    clock += 1000;
    state = processComments(state, [{ id: `demo-${++counter}`, username: 'prueba', text, ts: clock }], clock);
    world.setPlayers(state.players);
    const gained = total() - before;
    if (!gained) return { entries: [], msg: 'Límite diario (10) alcanzado: pulsa «Nuevo día»' };
    return { entries: state.players.prueba.log.slice(-gained), msg: okMsg };
  };

  build();
  demo = {
    comment: () => say('hola!', 'Comentario simulado: +1 cofre común'),
    event: () => say('DEMO', 'Código de evento canjeado'),
    nextDay: () => {
      clock += DAY;
      return { entries: [], msg: 'Ha pasado un día: el contador diario vuelve a 0' };
    },
    reset: () => {
      build();
      return { entries: state.players.prueba.log, msg: 'Cuenta de prueba reiniciada' };
    },
  };
} else {
  state = await (await fetch(params.get('state') ?? '../data/state.json', { cache: 'no-cache' })).json();
  world.setPlayers(state.players);
}

mountUi(document.getElementById('ui'), { world, getState: () => state, username: demo ? 'prueba' : null, demo });
window.__world = world;
