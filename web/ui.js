import { codeFor } from '../src/core/code.mjs';
import { openChest, itemById } from '../src/core/loot.mjs';

const RARITY_COLOR = { common: '#9aa3ad', rare: '#3b82f6', epic: '#a855f7', legendary: '#f59e0b' };
const RARITY_ORDER = ['legendary', 'epic', 'rare', 'common'];
const CHEST_LABEL = { welcome: 'Bienvenida', common: 'Común', event: 'Evento' };

// All text goes through textContent: usernames come from TikTok and must never be parsed as HTML.
function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const k of kids) e.append(k);
  return e;
}

/** Mount the HUD. `world` needs focus(username) and onSelect(fn); `getState()` returns the loaded state. */
export function mountUi(root, { world, getState }) {
  const bar = el('div', { className: 'bar' }, el('strong', { textContent: 'Pueblo de Cofres' }));
  const myBtn = el('button', { textContent: 'Mi casa' });
  const regBtn = el('button', { textContent: 'Registrarme' });
  bar.append(myBtn, regBtn);
  const panel = el('div', { className: 'panel hidden' });
  const modal = el('div', { className: 'modal hidden' });
  root.append(bar, panel, modal);

  const me = () => localStorage.getItem('pueblo:user') ?? '';

  function showRegister() {
    const input = el('input', { placeholder: 'tu @usuario de TikTok', value: me() });
    const out = el('div', { className: 'code' });
    const update = () => {
      const u = input.value.trim().replace(/^@/, '').toLowerCase();
      out.replaceChildren();
      if (!u) return;
      localStorage.setItem('pueblo:user', u);
      const exists = getState().players[u];
      out.append(
        el('p', { textContent: exists ? '¡Ya tienes casa!' : 'Comenta este código en cualquier vídeo:' }),
        el('div', { className: 'bigcode', textContent: codeFor(u) }),
        el('p', { className: 'hint', textContent: 'Tu casa aparece en unos minutos. Después, cada comentario te da un cofre.' }),
      );
    };
    input.addEventListener('input', update);
    const close = el('button', { textContent: 'Cerrar' });
    close.onclick = () => modal.classList.add('hidden');
    modal.replaceChildren(el('div', { className: 'card' }, el('h2', { textContent: 'Consigue tu casa' }), input, out, close));
    modal.classList.remove('hidden');
    update();
  }

  function playChest(entry, host) {
    const items = openChest(entry.type, entry.seed);
    const box = el('div', { className: 'chest shake', textContent: '🎁' });
    host.replaceChildren(box);
    setTimeout(() => {
      box.classList.remove('shake');
      box.textContent = '✨';
      host.append(
        el('div', { className: 'drops' }, ...items.map((it) =>
          el('span', { className: 'drop', textContent: it.name, style: `border-color:${RARITY_COLOR[it.rarity]}` }))),
      );
    }, 900);
  }

  function showPlayer(username) {
    const p = getState().players[username];
    if (!p) return null;
    const inv = Object.entries(p.inventory)
      .map(([id, n]) => ({ ...itemById(id), n }))
      .sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));
    const stage = el('div', { className: 'stage' });
    const replay = el('button', { textContent: 'Ver último cofre' });
    replay.disabled = p.log.length === 0;
    replay.onclick = () => playChest(p.log[p.log.length - 1], stage);
    const close = el('button', { textContent: '✕' });
    close.onclick = () => panel.classList.add('hidden');
    panel.replaceChildren(
      close,
      el('h3', { textContent: `@${username}` }),
      el('div', { className: 'life' }, el('div', { className: 'lifefill', style: `width:${p.life}%` })),
      el('p', { textContent: `Vida ${p.life}/100` }),
      el('p', { textContent: Object.entries(p.chests).map(([t, n]) => `${CHEST_LABEL[t]}: ${n}`).join(' · ') }),
      replay,
      stage,
      el('h4', { textContent: 'Inventario' }),
      el('div', { className: 'inv' }, ...(inv.length
        ? inv.map((it) => el('span', { className: 'item', textContent: `${it.name} ×${it.n}`, style: `border-color:${RARITY_COLOR[it.rarity]}` }))
        : [el('em', { textContent: 'Vacío' })])),
    );
    panel.classList.remove('hidden');
    return { stage, p };
  }

  myBtn.onclick = () => {
    const u = me();
    if (u && getState().players[u]) {
      world.focus(u);
      showPlayer(u);
    } else showRegister();
  };
  regBtn.onclick = showRegister;
  world.onSelect(showPlayer);

  // First visit of a registered player: replay their welcome chest.
  const u = me();
  if (u && getState().players[u] && !localStorage.getItem(`pueblo:seen:${u}`)) {
    localStorage.setItem(`pueblo:seen:${u}`, '1');
    world.focus(u);
    const r = showPlayer(u);
    if (r?.p.log[0]) playChest(r.p.log[0], r.stage);
  }
}
