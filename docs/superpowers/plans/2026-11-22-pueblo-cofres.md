# Pueblo de Cofres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free 3D shared map where TikTok commenters verify with a code, get a house, and open chests per comment.

**Architecture:** Pure-JS core (loot, state transitions) shared by a Node bot and the browser. A GitHub Actions cron fetches comments, runs the core, and commits `data/state.json`. A static three.js site on GitHub Pages renders that JSON.

**Tech Stack:** Node 20 (ESM, `node:test`, no deps for core), yt-dlp (comment fetch, to be validated by spike), three.js via importmap, GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-11-22-pueblo-cofres-design.md`

## Global Constraints

- Everything free: no paid APIs, hosting or services.
- New public repo `fbatlos/pueblo-cofres`; no tokens or cookies committed.
- One chest per TikTok comment id, ever (idempotent reprocessing).
- Daily cap per player: 10 common chests (constant `DAILY_CHEST_CAP`).
- Chest results are deterministic from `seed = comment_id`.
- Players start with life 100, empty inventory, 1 welcome chest.
- Code and comments in English; UI text in Spanish.
- Read-only, low-volume TikTok access.

## Review Focus

- Same comment seen on two bot runs: must not grant a second chest.
- Code typed with different case/spaces/emoji (`casa-7k2 `, `CASA-7K2🔥`): must still match.
- Someone comments another person's code: must not register or credit the other person; the commenter's own username is the identity.
- Commenter not registered yet: comment ignored (no pending chest), no crash.
- Empty/first-run `state.json` and 1,000+ players: bot and map still work, map stays smooth.
- Reply comments and deleted comments: replies count, missing comments never remove chests.

---

### Task 1: Repo scaffold and comment-fetch spike

**Files:**
- Create: `pueblo-cofres/` repo with `package.json`, `bot/fetch-comments.mjs`, `docs/spike.md`, `.gitignore`

**Interfaces:**
- Produces: `fetchComments(videoUrl: string): Promise<Comment[]>` where `Comment = {id: string, username: string, text: string, ts: number}`

- [ ] **Step 1:** `gh repo create pueblo-cofres --public`, clone next to `VideosIA`, add `package.json` (`"type":"module"`, script `test: node --test`).
- [ ] **Step 2:** Implement `fetchComments` by shelling to `yt-dlp --write-comments --skip-download -j <url>` and mapping the comments array to `Comment[]`.
- [ ] **Step 3:** Run it locally against one real video of the owner. Expected: array with ≥1 comment having non-empty `id` and `username`.
- [ ] **Step 4:** Add a manual-dispatch workflow `spike.yml` running the same call. Record in `docs/spike.md` whether local and Actions each work, and the fallback decision (run the bot on the owner's PC if Actions is blocked).
- [ ] **Step 5:** Commit `chore: scaffold repo and comment-fetch spike`.

### Task 2: Seeded loot and chest opening

**Files:**
- Create: `src/core/rng.mjs`, `src/core/loot.mjs`, `data/loot.json`
- Test: `test/loot.test.mjs`

**Interfaces:**
- Produces: `hashSeed(s: string): number`, `mulberry32(seed: number): () => number`, `openChest(type: 'welcome'|'common'|'event', seed: string): Item[]` with `Item = {id: string, name: string, kind: 'weapon'|'armor'|'consumable'|'decor', rarity: 'common'|'rare'|'epic'|'legendary'}`

- [ ] **Step 1:** Tests: `openChest('common','abc')` deep-equals itself on repeat; different seeds differ over 50 seeds; `welcome` always returns ≥1 item of rarity rare or better; over 10,000 seeds common-chest rarity frequencies are within ±3 points of the table in `loot.json`.
- [ ] **Step 2:** Run `npm test`; expect FAIL.
- [ ] **Step 3:** Implement RNG (mulberry32 over an FNV-1a hash) and weighted pick from `loot.json` (first draft: common 70 / rare 22 / epic 7 / legendary 1; ~12 items per kind, Spanish names).
- [ ] **Step 4:** `npm test`; expect PASS.
- [ ] **Step 5:** Commit `feat: deterministic chest loot`.

### Task 3: Game state transitions

**Files:**
- Create: `src/core/state.mjs`, `src/core/code.mjs`
- Test: `test/state.test.mjs`

**Interfaces:**
- Consumes: `openChest` (Task 2), `Comment` (Task 1).
- Produces: `codeFor(username: string): string` (format `CASA-XXX`, 3 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, derived from a hash of the lowercased username), `normalizeText(text: string): string`, `emptyState(): State`, `processComments(state: State, comments: Comment[], now: number): State`.
- `State = {players: Record<username,{house:{x,z,seed},life:number,inventory:Item[],chests:{welcome:number,common:number,event:number},daily:{day:string,n:number}}>, seen: string[], events: Record<code,string>}`

- [ ] **Step 1:** Tests, one case each: a comment by `maria` containing `codeFor('maria')` in any case/spacing/emoji creates her player (life 100, empty inventory, 1 welcome chest, deterministic house position); `pepe` commenting `codeFor('maria')` registers nothing for maria and, absent a code of his own, nothing for pepe; comment from an unregistered user without a code changes nothing; the same comment id processed twice grants one chest; the 11th comment of a day grants no chest; a new day resets the count; an event code in `events` grants one event chest per player per code.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement per signatures. `seen` keeps the last 5,000 ids. House positions follow a spiral grid so houses never overlap.
- [ ] **Step 4:** Run; expect PASS.
- [ ] **Step 5:** Commit `feat: state transitions with caps and idempotency`.

### Task 4: Bot runner and scheduled workflow

**Files:**
- Create: `bot/run.mjs`, `.github/workflows/bot.yml`, `config/videos.json`, `data/state.json`
- Test: `test/run.test.mjs`

**Interfaces:**
- Consumes: `fetchComments`, `processComments`, `emptyState`.
- Produces: `run({fetch, readState, writeState, videos, now}): Promise<{newChests:number}>` (dependencies injected).

- [ ] **Step 1:** Test with a fake `fetch` returning two videos: state written once, `newChests` correct, one failing video fetch neither erases state nor aborts the other video.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement `run` and a CLI entry wiring real fs + yt-dlp, reading `config/videos.json`. Workflow: cron every 30 min plus manual dispatch, installs yt-dlp, runs the bot, commits `data/state.json` only if changed (message ends `[skip ci]`).
- [ ] **Step 4:** Run tests; trigger the workflow manually. Expected: green run and a state commit.
- [ ] **Step 5:** Commit `feat: bot runner and cron workflow`.

### Task 5: 3D map

**Files:**
- Create: `web/index.html`, `web/map.js`

**Interfaces:**
- Consumes: `data/state.json`.
- Produces: `buildMap(scene: THREE.Scene, players: State['players']): void` using one `InstancedMesh` for house bodies and one for roofs, colors from `house.seed`; clicking a house dispatches `house-selected` with `{username}`.

- [ ] **Step 1:** Scene with ground, light, orbit/touch controls, three.js from an importmap.
- [ ] **Step 2:** Render houses from state; username labels only for the nearest 30 houses.
- [ ] **Step 3:** Verify in the browser pane with a generated 1,500-player fake state: loads, orbits smoothly, no console errors.
- [ ] **Step 4:** Commit `feat: instanced 3D town map`.

### Task 6: Registration, player panel and chest UI

**Files:**
- Create: `web/ui.js`, `web/style.css`

**Interfaces:**
- Consumes: `codeFor`, `openChest` (imported from `src/core`, served with the site), `house-selected` event.
- Produces: registration screen (username input → shows `codeFor(username)` and "comment this on any video"); player panel (life bar, inventory grid, chest counts); chest animation that shows `openChest(type, seed)` results.

- [ ] **Step 1:** Registration screen and panel; chest opening is a replay of the same deterministic function the bot used, so it needs no server (test: same seed in browser module and in Node gives identical items).
- [ ] **Step 2:** Verify in the browser: typing a username shows its code; with a fixture state, clicking a house opens the panel with inventory and chests.
- [ ] **Step 3:** Commit `feat: registration, player panel and chest UI`.

### Task 7: Deploy and handoff

**Files:**
- Create: `.github/workflows/pages.yml`, `README.md`

- [ ] **Step 1:** Workflow publishing `web/`, `src/core/` and `data/` to GitHub Pages on push to main.
- [ ] **Step 2:** README (Spanish): add a video to `config/videos.json`, create an event code in `state.events`, run the bot locally if Actions is blocked.
- [ ] **Step 3:** Push, enable Pages, open the live URL; expected: map loads with the real `state.json`.
- [ ] **Step 4:** Link the project in `ESTADO-PROYECTO.md` of VideosIA and commit.

## Self-review notes
- Spec coverage: verification code, house/life/inventory/welcome chest, comment chests with cap, event codes, visit map, free hosting, spike + fallback. Phase 2 (battles/ranking) and Phase 3 (Login Kit) are intentionally out of this plan.
- Verification model: identity is the commenter's TikTok username; the code only signals intent to register.
