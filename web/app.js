import { createWorld } from './map.js';
import { mountUi } from './ui.js';

const params = new URLSearchParams(location.search);
const stateUrl = params.get('state') ?? '../data/state.json';
const world = createWorld(document.getElementById('world'));
const state = await (await fetch(stateUrl, { cache: 'no-cache' })).json();
world.setPlayers(state.players);
mountUi(document.getElementById('ui'), { world, getState: () => state });
window.__world = world;
