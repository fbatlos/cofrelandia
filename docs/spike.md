# Spike: reading TikTok comments for free (2026-11-22)

- `yt-dlp --write-comments` returns **no** comments for TikTok (video had 86, got none). Discarded.
- tikwm free endpoint `https://www.tikwm.com/api/comment/list`: works **locally** (57 comments) and from
  **GitHub Actions** (58 comments, run 45041195670). Chosen.
- Limits: top-level comments only (replies not fetched yet); third-party service, so it may rate-limit or
  disappear. Fallback: run the bot from the owner's PC, or swap `bot/fetch-comments.mjs` for another source.
