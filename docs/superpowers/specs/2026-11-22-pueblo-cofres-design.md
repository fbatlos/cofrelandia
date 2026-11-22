# Pueblo de Cofres — design (2026-11-22)

## Intent
A free, cloud-hosted 3D shared map where every TikTok commenter gets a house.
Comments on the owner's videos open loot chests. The game exists to make people
comment and follow: the owner has no followers yet, so engagement is the goal.

## Goals
- Player verifies a TikTok account by commenting a code on any of the owner's videos.
- Each verified player gets a 3D house, life, inventory and a one-time welcome chest.
- Every new comment (1 per comment id, daily cap) grants a common chest; special
  videos carry an event code that grants rare chests.
- Players can visit the shared map and other houses.
- Weekly/monthly simulated battles + ranking with rewards (phase 2).

## Non-goals
- No paid services, no paid APIs (user constraint: everything free).
- No official TikTok login in MVP (Login Kit needs review; optional later).
- No real-time multiplayer, no player-controlled combat.

## Anti-goals
- A bot/scraper that gets the TikTok account banned.
- Spam comments farming infinite chests.
- Anything that stops working the day TikTok changes a page, with no fallback.

## Approaches
- **A. Comment-code (chosen):** code in web -> comment on video -> scraper credits it.
  Free, no approval, works with zero followers. Risk: unofficial comment reading.
- B. TikTok Login Kit: official, but needs approval and exposes no third-party comments.
- C. Live connector: only works while live; useless without an audience.

## Design
- **Repo:** new public repo `pueblo-cofres` (GitHub Pages needs public on free plan).
  Keeps secrets out of the private factory repo.
- **Frontend:** static site, three.js, low-poly houses generated from `data/*.json`
  (instanced meshes so a big map stays light on phones). Hosted on GitHub Pages.
- **Data:** JSON files in the repo (players, chests, ranking) written only by Actions.
  Supabase free tier is the upgrade path if JSON gets too big.
- **Bot (GitHub Actions cron):** reads comments of the owner's videos, matches codes,
  creates players, grants chests, enforces caps, commits JSON.
- **Chest logic:** deterministic from `seed = comment_id`, so results are reproducible
  and cheat-resistant. Loot tables (weapons, items, rarities) tuned in a later step.
- **Battles (phase 2):** weekly Action simulates fights with a fixed seed, publishes
  ranking + replay JSON; the web plays the replay (also usable as TikTok content).

## Constraints / risks
- Comment reading from GitHub Actions IPs may be blocked by TikTok. First step is a
  small spike to test it; fallback is running the scraper on the owner's PC (Task
  Scheduler) and pushing the JSON.
- Scraping may breach TikTok terms; keep request volume low, read-only.
- Public repo: stored data is only public TikTok usernames; no tokens in the repo.

## MVP scope
1. Spike: read comments of one video, free, from Actions and from local PC.
2. Registration code flow + house + life/inventory/chests data model.
3. 3D map + house view + chest opening UI.
4. Daily caps, event codes.
Phase 2: battles, ranking, rewards. Phase 3: optional Login Kit.

## Left to the builder
Loot tables and balance, art style of houses, map layout, exact scraping library.
