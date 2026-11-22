// Fetch public comments of a TikTok video through tikwm's free endpoint.
// Ruling: yt-dlp has no comment support for TikTok (spike, 2026-11-22), so tikwm is used.

const ENDPOINT = 'https://www.tikwm.com/api/comment/list';
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

/** Map one raw tikwm comment to the game's Comment shape, or null when it is unusable. */
export function mapComment(raw) {
  const ts = Number(raw.create_time) * 1000;
  const id = raw.id == null ? '' : String(raw.id);
  const username = String(raw.user?.unique_id ?? '').toLowerCase();
  if (!id || !username || !Number.isFinite(ts)) return null;
  return { id, username, text: String(raw.text ?? ''), ts };
}

/**
 * @param {string} videoUrl
 * @param {{fetchImpl?: typeof fetch, delayMs?: number}} [opts]
 * @returns {Promise<{id:string,username:string,text:string,ts:number}[]>}
 */
export async function fetchComments(videoUrl, { fetchImpl = fetch, delayMs = 1100 } = {}) {
  const out = [];
  let cursor = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = `${ENDPOINT}?url=${encodeURIComponent(videoUrl)}&count=${PAGE_SIZE}&cursor=${cursor}`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`tikwm HTTP ${res.status}`);
    const body = await res.json();
    if (body.code !== 0) throw new Error(`tikwm error: ${body.msg}`);
    for (const c of body.data?.comments ?? []) {
      const mapped = mapComment(c);
      if (mapped) out.push(mapped);
    }
    if (!body.data?.hasMore || body.data.cursor == null) break;
    cursor = body.data.cursor;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return out;
}

if (process.argv[2]?.startsWith('http')) {
  const comments = await fetchComments(process.argv[2]);
  console.log(`${comments.length} comments`, comments.slice(0, 3));
}
