import { createWorld } from './map.js';

const params = new URLSearchParams(location.search);
const stateUrl = params.get('state') ?? '../data/state.json';
const world = createWorld(document.getElementById('world'));
const state = await (await fetch(stateUrl, { cache: 'no-cache' })).json();
world.setPlayers(state.players);
window.__world = world;
