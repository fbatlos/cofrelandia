// Fetch public comments of a TikTok video through tikwm's free endpoint.
// Ruling: yt-dlp has no comment support for TikTok (spike, 2026-11-22), so tikwm is used.

const ENDPOINT = 'https://www.tikwm.com/api/comment/list';
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

/** Map one raw tikwm comment to the game's Comment shape. */
export function mapComment(raw) {
  return {
    id: String(raw.id),
    username: String(raw.user?.unique_id ?? '').toLowerCase(),
    text: String(raw.text ?? ''),
    ts: Number(raw.create_time ?? 0) * 1000,
  };
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
    for (const c of body.data?.comments ?? []) out.push(mapComment(c));
    if (!body.data?.hasMore) break;
    cursor = body.data.cursor;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return out.filter((c) => c.id && c.username);
}

if (process.argv[2]?.startsWith('http')) {
  const comments = await fetchComments(process.argv[2]);
  console.log(`${comments.length} comments`, comments.slice(0, 3));
}
