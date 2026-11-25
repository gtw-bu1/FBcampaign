// 粉專上「目前還沒發出去的排程貼文」清單。唯讀。
//
// 為什麼要這支(2026-11-25 真實事故):
// 使用者 11-18 用工具排了一則 11/25 14:00 的貼文,工具回「已排程」,
// 但她到 Facebook 商務管理平台的「規劃工具」看是空的,以為排程失敗。
// 今天 14:00:01 那則**確實自動發布了**(id 284455941624148_1572308271600147),
// 可是她在 14:00 前已經不相信排程,於是 15:00 又手動發了一次,
// 15:03 因為網址打不開又發一次 → 同一個活動在粉專上出現三則。
//
// 根因是 Facebook 的介面:**用 API 建立的 unpublished post 不一定出現在規劃工具的日曆上**
// (11-18 當天就確認過這個現象)。所以不能把「去 FB 的規劃工具看」當成確認方式——
// 要讓工具自己把 Facebook 上的真實排程佇列顯示出來。
//
// 權限:讀 scheduled_posts 需要粉專權杖(用戶權杖讀不到),所以一律先 resolvePageToken。
import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';

const GRAPH_VERSION = 'v27.0';
const FIELDS = 'id,message,created_time,scheduled_publish_time,full_picture';

// 排程時間轉成台北時間的字串。Graph 給的是 UNIX 秒數。
export function taipeiTime(unixSeconds) {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n) || n <= 0) return '';
  // Intl 會在日期與時間之間塞 U+2009 細空格,複製貼上與比對都會出怪事,換成普通空格。
  return new Date(n * 1000).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(/[\u2000-\u200a\u202f\u00a0]/g, ' ');
}

// 把 Graph 的排程貼文壓成畫面要的形狀,並標出「時間已經過了卻還在佇列裡」的異常。
export function normalizeScheduled(raw, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!raw || typeof raw !== 'object') return null;
  const at = Number(raw.scheduled_publish_time) || 0;
  return {
    id: raw.id || '',
    at,
    atText: taipeiTime(at),
    overdue: at > 0 && at < nowSeconds,
    message: typeof raw.message === 'string' ? raw.message : '',
    picture: raw.full_picture || ''
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: '僅接受 GET 或 POST。' });
  }

  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) {
    return res.status(503).json({ error: '尚未啟用 FB 功能。請在 Vercel 設定 FB_PAGE_ID 與 FB_PAGE_ACCESS_TOKEN。' });
  }

  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);
  if (denied) return res.status(denied.startsWith('尚未設定') ? 503 : 401).json({ error: denied });

  let token;
  try {
    ({ token } = await resolvePageToken(rawToken, pageId));
  } catch (error) {
    return res.status(502).json({ error: error?.message || '無法取得粉絲專頁權杖。' });
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/scheduled_posts?fields=${FIELDS}&limit=50`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const e = payload?.error;
      return res.status(502).json({ error: `讀不到排程貼文:${e?.message || `HTTP ${response.status}`}` });
    }
    const posts = (payload?.data || []).map((p) => normalizeScheduled(p)).filter(Boolean)
      .sort((a, b) => a.at - b.at);
    return res.status(200).json({ ok: true, count: posts.length, posts });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時,請重試。' : (error?.message || '查詢失敗,請重試。');
    return res.status(502).json({ error: msg });
  }
}
