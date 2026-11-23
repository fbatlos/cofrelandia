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
  prize: { label: 'Premio', icon: '🏆' },
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
export function mountUi(root, { world, getState, getSeason = () => null, username = null, demo = null }) {
  let user = username ?? localStorage.getItem('pueblo:user') ?? '';
  let shown = null;

  const count = el('span', { className: 'pill' });
  const topbar = el('header', { className: 'topbar glass' }, el('span', { className: 'logo', textContent: '🏘️ Cofrelandia' }), count);
  const mkBtn = (icon, label, onclick, cls = '') => {
    const b = el('button', { className: `btn ${cls}`.trim(), onclick }, el('span', { className: 'ico', textContent: icon, ariaHidden: 'true' }), el('span', { textContent: label }));
    return b;
  };
  const myBtn = mkBtn('🏠', 'Mi casa', () => goHome());
  const joinBtn = mkBtn('✍️', 'Unirme', () => showRegister(), 'ghost');
  const rankBtn = mkBtn('🏆', 'Ranking', () => showRanking(), 'ghost');
  const dock = el('nav', { className: 'dock glass', ariaLabel: 'Menú' }, myBtn, rankBtn, joinBtn);
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
        el('div', { className: 'chip' }, el('span', { className: 'ico', textContent: c.icon }), el('strong', { textContent: String(p.chests[t] ?? 0) }), el('small', { textContent: c.label })))),
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

  const MEDAL = ['🥇', '🥈', '🥉'];

  function playReplay(match) {
    const hpBar = (f) => {
      const fill = el('div', { className: 'hpfill' });
      return { fill, node: el('div', { className: 'hp' }, el('small', { textContent: `${f.name} · ❤️ ${f.life}` }), el('div', { className: 'hpbar' }, fill)) };
    };
    const A = hpBar(match.a);
    const B = hpBar(match.b);
    const setHp = (bar, f, hp) => { bar.fill.style.width = `${Math.max(0, (hp / f.life) * 100)}%`; };
    setHp(A, match.a, match.a.life);
    setHp(B, match.b, match.b.life);
    const log = el('div', { className: 'battlelog', ariaLive: 'polite' });
    const verdict = el('p', { className: 'banner', hidden: true });
    const close = el('button', { className: 'btn', textContent: 'Cerrar' });
    let timer = null;
    close.onclick = () => { clearInterval(timer); closeOverlay(overlay); };
    overlay.onclick = (e) => { if (e.target === overlay) close.onclick(); };
    overlay.style.setProperty('--glow', '#ff5d73');
    overlay.replaceChildren(el('div', { className: 'sheet' },
      el('h2', { textContent: '⚔️ Combate destacado' }),
      el('div', { className: 'duel' }, A.node, el('span', { className: 'vs', textContent: 'VS' }), B.node),
      log, verdict, close));
    overlay.classList.remove('hidden');
    let i = 0;
    timer = setInterval(() => {
      const s = match.rounds[i++];
      if (!s) {
        clearInterval(timer);
        verdict.textContent = match.winner === 'draw' ? '🤝 Empate' : `🏆 Gana @${match.winner === 'a' ? match.a.name : match.b.name}`;
        verdict.hidden = false;
        return;
      }
      const who = s.actor === 'a' ? match.a.name : match.b.name;
      setHp(A, match.a, s.hpA);
      setHp(B, match.b, s.hpB);
      const text = s.kind === 'heal' ? `💚 ${who} se cura (+${s.amount})` : s.kind === 'crit' ? `💥 ${who} ¡crítico! (-${s.amount})` : `⚔️ ${who} golpea (-${s.amount})`;
      log.append(el('div', { textContent: text }));
      log.scrollTop = log.scrollHeight;
    }, 450);
  }

  function showRanking() {
    const season = getSeason();
    const rows = season?.table ?? [];
    const close = el('button', { className: 'btn ghost', textContent: 'Cerrar' });
    close.onclick = () => closeOverlay(modal);
    modal.onclick = (e) => { if (e.target === modal) closeOverlay(modal); };
    const sheet = el('div', { className: 'sheet wide' }, el('h2', { textContent: season?.week ? `🏆 Ranking ${season.week}` : '🏆 Ranking' }));
    if (!rows.length) {
      sheet.append(el('p', { className: 'empty', textContent: 'Aún no ha habido batallas. La próxima es el domingo a las 20:00 UTC: cuantos mejores objetos tengas, más posibilidades de ganar.' }));
    } else {
      const rowEl = (r) => el('li', { className: r.username === user ? 'row mine' : 'row' },
        el('span', { className: 'pos', textContent: MEDAL[r.rank - 1] ?? `#${r.rank}` }),
        el('span', { className: 'who2', textContent: `@${r.username}` }),
        el('span', { className: 'pts', textContent: `${r.points} pts · ${r.wins}V` }),
        el('small', { textContent: `⚡${r.power}` }));
      const list = el('ol', { className: 'rank' }, ...rows.slice(0, 10).map(rowEl));
      sheet.append(list);
      const mineRow = rows.find((r) => r.username === user);
      if (mineRow && mineRow.rank > 10) sheet.append(el('ol', { className: 'rank' }, rowEl(mineRow)));
      if (user && !mineRow) sheet.append(el('p', { className: 'hint', textContent: 'Tu casa aún no está en este ranking.' }));
      if (season.featured?.length) {
        const watch = el('button', { className: 'btn', textContent: '⚔️ Ver combate destacado' });
        watch.onclick = () => { closeOverlay(modal); playReplay(season.featured[0]); };
        sheet.append(watch);
      }
      if (season.beauty?.length) {
        sheet.append(el('h4', { textContent: 'Casas más bonitas' }),
          el('ol', { className: 'rank' }, ...season.beauty.slice(0, 3).map((b, i) =>
            el('li', { className: 'row' }, el('span', { className: 'pos', textContent: MEDAL[i] }), el('span', { className: 'who2', textContent: `@${b.username}` }), el('span', { className: 'pts', textContent: `🏠 ${b.charm}` })))));
      }
      const past = (season.history ?? []).slice(-6, -1).reverse();
      if (past.length) sheet.append(el('h4', { textContent: 'Campeones anteriores' }), el('p', { className: 'hint', textContent: past.map((h) => `${h.week}: @${h.champion}`).join(' · ') }));
    }
    sheet.append(el('p', { className: 'hint', textContent: 'Premios: 🥇 3 cofres de premio · 🥈🥉 2 · top 10: 1 · casas más bonitas: 1.' }), close);
    modal.replaceChildren(sheet);
    modal.classList.remove('hidden');
  }

  function runDemo(action) {
    const { entries, msg } = demo[action]();
    refresh();
    if (action === 'reset') shown = null;
    if (!panel.classList.contains('open') || action === 'reset') renderPlayer('prueba');
    world.focus('prueba');
    toast(msg);
    if (action === 'battle') showRanking();
    if (entries.length) playChest(entries.find((e) => e.type === 'event') ?? entries[entries.length - 1]);
  }

  if (demo) {
    const tray = el('div', { className: 'tray glass' },
      el('span', { className: 'tag', textContent: '🧪 Prueba' }),
      mkBtn('💬', 'Comentar', () => runDemo('comment')),
      mkBtn('💎', 'Evento', () => runDemo('event')),
      mkBtn('⚔️', 'Batalla', () => runDemo('battle')),
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
