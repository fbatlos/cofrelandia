import { codeFor } from '../src/core/code.mjs';
import { openChest } from '../src/core/loot.mjs';
import { playerStats, ownedItems, SLOTS } from '../src/core/equip.mjs';

const RARITY = {
  common: { label: 'Común', color: '#9aa3ad' },
  rare: { label: 'Raro', color: '#4da3ff' },
  epic: { label: 'Épico', color: '#b667ff' },
  legendary: { label: 'Legendario', color: '#ffb938' },
};
const ORDER = ['legendary', 'epic', 'rare', 'common'];
const STAT_LABEL = { atk: 'ATQ', def: 'DEF', hp: 'VIDA', luck: 'SUERTE', heal: 'CURA', charm: 'ENCANTO' };
const statLine = (stats) => Object.entries(stats).map(([k, v]) => `+${v} ${STAT_LABEL[k] ?? k}`).join(' · ');
const CHEST = {
  welcome: { label: 'Bienvenida', icon: '🎁' },
  common: { label: 'Comunes', icon: '📦' },
  event: { label: 'Evento', icon: '💎' },
};

// All text goes through textContent: usernames come from TikTok and must never be parsed as HTML.
function el(tag, props = {}, ...kids) {
  const { vars, ...rest } = props;
  const e = document.createElement(tag);
  Object.assign(e, rest);
  for (const [k, v] of Object.entries(vars ?? {})) e.style.setProperty(k, v);
  for (const k of kids) e.append(k);
  return e;
}

const has = (players, u) => Object.hasOwn(players, u);

/**
 * Mount the HUD.
 * `world`: focus(username), select(username), setMine(username), onSelect(fn).
 * `getState()`: current state. `username`: fixed user (demo). `demo`: optional simulator
 * {comment, event, nextDay, reset}, each returning {entries: LogEntry[], msg: string}.
 */
export function mountUi(root, { world, getState, username = null, demo = null }) {
  let user = username ?? localStorage.getItem('pueblo:user') ?? '';
  let shown = null;

  const count = el('span', { className: 'pill' });
  const topbar = el('header', { className: 'topbar glass' }, el('span', { className: 'logo', textContent: '🏘️ Pueblo de Cofres' }), count);
  const mkBtn = (icon, label, onclick, cls = '') => {
    const b = el('button', { className: `btn ${cls}`.trim(), onclick }, el('span', { className: 'ico', textContent: icon, ariaHidden: 'true' }), el('span', { textContent: label }));
    return b;
  };
  const myBtn = mkBtn('🏠', 'Mi casa', () => goHome());
  const joinBtn = mkBtn('✍️', 'Unirme', () => showRegister(), 'ghost');
  const dock = el('nav', { className: 'dock glass', ariaLabel: 'Menú' }, myBtn, joinBtn);
  const panel = el('section', { className: 'panel glass', ariaLive: 'polite' });
  const overlay = el('div', { className: 'overlay hidden', role: 'dialog', ariaModal: 'true', ariaLabel: 'Cofre' });
  const modal = el('div', { className: 'overlay hidden', role: 'dialog', ariaModal: 'true', ariaLabel: 'Unirme' });
  const toastEl = el('div', { className: 'toast', role: 'status' });
  root.append(topbar, panel, dock, overlay, modal, toastEl);

  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  function refresh() {
    const players = getState().players;
    count.textContent = `🏠 ${Object.keys(players).length} vecinos`;
    world.setMine(has(players, user) ? user : null);
    if (shown && has(players, shown)) renderPlayer(shown);
  }

  function closeOverlay(node) {
    node.classList.add('hidden');
    node.replaceChildren();
  }

  function playChest(entry) {
    const items = openChest(entry.type, entry.seed);
    const best = items.reduce((b, it) => (ORDER.indexOf(it.rarity) < ORDER.indexOf(b) ? it.rarity : b), 'common');
    const stage = el('div', { className: 'chest-stage' }, el('div', { className: 'chest shake', textContent: CHEST[entry.type].icon }));
    const drops = el('div', { className: 'drops' });
    const done = el('button', { className: 'btn', textContent: '¡Genial!', hidden: true });
    const banner = el('div', { className: 'banner', hidden: true, textContent: best === 'legendary' ? '¡LEGENDARIO!' : best === 'epic' ? '¡ÉPICO!' : '' });
    done.onclick = () => closeOverlay(overlay);
    overlay.onclick = (e) => e.target === overlay && closeOverlay(overlay);
    overlay.style.setProperty('--glow', RARITY[best].color);
    overlay.replaceChildren(el('div', { className: 'sheet' }, el('h2', { textContent: `Cofre de ${CHEST[entry.type].label.toLowerCase()}` }), stage, banner, drops, done));
    overlay.classList.remove('hidden');
    done.focus({ preventScroll: true });
    setTimeout(() => {
      stage.classList.add('opened');
      stage.firstChild.classList.remove('shake');
      stage.firstChild.textContent = '✨';
      banner.hidden = !banner.textContent;
      items.forEach((it, i) =>
        drops.append(
          el('div', { className: 'drop', vars: { '--c': RARITY[it.rarity].color, '--i': i } },
            el('span', { className: 'ico', textContent: it.icon }),
            el('strong', { textContent: it.name }),
            el('small', { textContent: `${RARITY[it.rarity].label} · ${statLine(it.stats)}` })),
        ),
      );
      done.hidden = false;
    }, 1000);
  }

  function renderPlayer(name) {
    const p = getState().players[name];
    shown = name;
    world.select(name);
    const stats = playerStats(p.inventory);
    const equipped = new Set(Object.values(stats.loadout).flat().map((it) => it.id));
    const inv = ownedItems(p.inventory).sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity) || a.name.localeCompare(b.name));
    const slotTile = (def, it) =>
      it
        ? el('div', { className: 'tile slot', vars: { '--c': RARITY[it.rarity].color } },
          el('span', { className: 'ico', textContent: it.icon }),
          el('span', { className: 'nm', textContent: it.name }),
          el('small', { className: 'st', textContent: statLine(it.stats) }))
        : el('div', { className: 'tile slot vacant' },
          el('span', { className: 'ico', textContent: def.icon }),
          el('span', { className: 'nm', textContent: `${def.label} vacío` }));
    const slotTiles = SLOTS.flatMap((def) => Array.from({ length: def.size }, (_, i) => slotTile(def, stats.loadout[def.slot][i])));
    const mkChip = (icon, label, value) =>
      el('div', { className: 'chip' }, el('span', { className: 'ico', textContent: icon }), el('strong', { textContent: String(value) }), el('small', { textContent: label }));
    const close = el('button', { className: 'x', textContent: '✕', ariaLabel: 'Cerrar panel' });
    close.onclick = () => {
      panel.classList.remove('open');
      shown = null;
      world.select(null);
    };
    const replay = el('button', { className: 'btn ghost', textContent: '🎁 Ver último cofre', disabled: p.log.length === 0 });
    replay.onclick = () => playChest(p.log[p.log.length - 1]);
    panel.replaceChildren(
      close,
      el('div', { className: 'who' },
        el('div', { className: 'avatar', textContent: name[0]?.toUpperCase() ?? '?' }),
        el('div', {}, el('h3', { textContent: `@${name}` }), el('small', { textContent: name === user ? 'Tu casa' : 'Vecino' }))),
      el('div', { className: 'life', role: 'img', ariaLabel: `Vida ${stats.life}, poder ${stats.power}` }, el('div', { className: 'lifefill' }), el('span', { textContent: `❤️ ${stats.life} · ⚡ Poder ${stats.power}` })),
      el('div', { className: 'stats' }, mkChip('⚔️', 'ATQ', stats.atk), mkChip('🛡️', 'DEF', stats.def), mkChip('🍀', 'SUERTE', stats.luck), mkChip('🏠', 'ENCANTO', stats.charm)),
      el('h4', { textContent: 'Equipado' }),
      el('div', { className: 'slots' }, ...slotTiles),
      el('div', { className: 'chests' }, ...Object.entries(CHEST).map(([t, c]) =>
        el('div', { className: 'chip' }, el('span', { className: 'ico', textContent: c.icon }), el('strong', { textContent: String(p.chests[t]) }), el('small', { textContent: c.label })))),
      replay,
      el('h4', { textContent: 'Inventario' }),
      inv.length
        ? el('div', { className: 'inv' }, ...inv.map((it) =>
          el('div', { className: equipped.has(it.id) ? 'tile eq' : 'tile', vars: { '--c': RARITY[it.rarity].color }, title: `${it.name} · ${RARITY[it.rarity].label} · ${statLine(it.stats)}` },
            el('span', { className: 'ico', textContent: it.icon }),
            el('span', { className: 'nm', textContent: it.name }),
            el('small', { className: 'st', textContent: statLine(it.stats) }),
            el('b', { textContent: it.n > 1 ? `×${it.n}` : equipped.has(it.id) ? '✓' : '' }))))
        : el('p', { className: 'empty', textContent: 'Aún no tienes objetos. Comenta en los vídeos para ganar cofres.' }),
    );
    panel.classList.add('open');
  }

  function goHome() {
    const players = getState().players;
    if (user && has(players, user)) {
      world.focus(user);
      renderPlayer(user);
    } else showRegister();
  }

  function showRegister() {
    const input = el('input', { placeholder: 'tu usuario de TikTok', value: user, autocomplete: 'off', autocapitalize: 'none', ariaLabel: 'Usuario de TikTok' });
    const out = el('div', { className: 'steps' });
    const update = () => {
      const u = input.value.trim().replace(/^@/, '').toLowerCase();
      out.replaceChildren();
      if (!u) return;
      user = u;
      if (!username) localStorage.setItem('pueblo:user', u);
      world.setMine(has(getState().players, u) ? u : null);
      if (has(getState().players, u)) {
        out.append(el('p', { className: 'ok', textContent: '¡Ya tienes casa en el pueblo!' }));
        return;
      }
      const copy = el('button', { className: 'btn', textContent: 'Copiar código' });
      copy.onclick = async () => {
        try {
          await navigator.clipboard.writeText(codeFor(u));
          toast('Código copiado');
        } catch {
          toast('Copia el código a mano');
        }
      };
      out.append(
        el('p', { textContent: '2. Comenta este código en cualquier vídeo:' }),
        el('div', { className: 'bigcode', textContent: codeFor(u) }),
        copy,
        el('p', { className: 'hint', textContent: '3. Comenta directamente en el vídeo, no como respuesta a otro comentario. Tu casa aparece en unos minutos y cada comentario después te da un cofre.' }),
      );
    };
    input.addEventListener('input', update);
    const close = el('button', { className: 'btn ghost', textContent: 'Cerrar' });
    close.onclick = () => closeOverlay(modal);
    modal.onclick = (e) => e.target === modal && closeOverlay(modal);
    modal.replaceChildren(el('div', { className: 'sheet' }, el('h2', { textContent: 'Consigue tu casa' }), el('p', { textContent: '1. Escribe tu usuario de TikTok:' }), input, out, close));
    modal.classList.remove('hidden');
    input.focus({ preventScroll: true });
    update();
  }

  function runDemo(action) {
    const { entries, msg } = demo[action]();
    refresh();
    if (action === 'reset') shown = null;
    if (!panel.classList.contains('open') || action === 'reset') renderPlayer('prueba');
    world.focus('prueba');
    toast(msg);
    if (entries.length) playChest(entries.find((e) => e.type === 'event') ?? entries[entries.length - 1]);
  }

  if (demo) {
    const tray = el('div', { className: 'tray glass' },
      el('span', { className: 'tag', textContent: '🧪 Prueba' }),
      mkBtn('💬', 'Comentar', () => runDemo('comment')),
      mkBtn('💎', 'Evento', () => runDemo('event')),
      mkBtn('🌅', 'Nuevo día', () => runDemo('nextDay'), 'ghost'),
      mkBtn('♻️', 'Reiniciar', () => runDemo('reset'), 'ghost'));
    root.append(tray);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    closeOverlay(overlay);
    closeOverlay(modal);
  });
  world.onSelect((u) => renderPlayer(u));
  refresh();

  // First visit of a registered player (or demo start): replay their welcome chest.
  const players = getState().players;
  const seenKey = `pueblo:seen:${user}`;
  if (user && has(players, user) && (demo || !localStorage.getItem(seenKey))) {
    if (!demo) localStorage.setItem(seenKey, '1');
    world.focus(user);
    renderPlayer(user);
    if (players[user].log[0]) playChest(players[user].log[0]);
  }
}
