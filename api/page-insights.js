// 讀取粉絲專頁過去貼文的成效,給「預估這則貼文會有多少互動」用。
//
// 權限分兩層,刻意設計成「拿不到洞察也要能用」:
//   必要:pages_read_engagement
//         → /{page_id}/published_posts 的 message、created_time、
//           reactions.summary、comments.summary、shares
//   選用:read_insights(且權杖持有人要能在粉專執行 ANALYZE 任務)
//         → 觸及與互動人數。沒有這個權限時本端點仍會回傳按讚/留言/分享,
//           只是 insightsAvailable=false。
//
// 2026-11-17 查證:Meta 已停用大批曝光指標——
//   post_impressions*       2025-11-15 停用(替代 post_media_view)
//   post_impressions_unique* 2025-06-15 停用(替代 post_total_media_view_unique)
//   post_activity / post_activity_unique 2024-03-14 停用
// 所以這裡只呼叫替代後的新指標名,舊名稱會回「無效的衡量指標」錯誤。
// 出處:developers.facebook.com/docs/platforminsights/page/deprecated-metrics
import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';

const GRAPH_VERSION = 'v27.0';
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

// 只用現行有效的指標名。任何一個被停用,Graph 會整個要求回錯,
// 所以 insights 是「盡力取得」:失敗就降級,不讓主要資料跟著死。
const POST_INSIGHT_METRICS = ['post_media_view', 'post_total_media_view_unique'];

const POST_FIELDS = [
  'id',
  'message',
  'created_time',
  'permalink_url',
  'full_picture',
  'reactions.summary(true).limit(0)',
  'comments.summary(true).limit(0)',
  'shares'
].join(',');

export function parseLimit(raw) {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// 把 Graph 的貼文物件壓成前端與預估模組要用的扁平形狀。
export function normalizePost(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const reactions = raw.reactions?.summary?.total_count ?? 0;
  const comments = raw.comments?.summary?.total_count ?? 0;
  const shares = raw.shares?.count ?? 0;
  return {
    id: raw.id || '',
    message: typeof raw.message === 'string' ? raw.message : '',
    createdTime: raw.created_time || '',
    permalink: raw.permalink_url || '',
    hasImage: Boolean(raw.full_picture),
    reactions,
    comments,
    shares,
    // 互動總數:按讚/心情 + 留言 + 分享。這是不需要 read_insights 就拿得到的口徑,
    // 跟 Facebook 後台的「互動人數」定義不同(那個是不重複人數),不要混用。
    engagement: reactions + comments + shares
  };
}

export function readGraphError(payload, status) {
  const e = payload?.error;
  if (!e) return `Facebook 回應異常(HTTP ${status})。`;
  const detail = [e.message, e.error_user_msg].filter(Boolean).join(' / ') || `代碼 ${e.code ?? '未知'}`;
  if (e.code === 190) return `權杖已失效或過期,需要重新產生粉絲專頁存取權杖。(${detail})`;
  // 2026-11-18 實測:/{page_id}/published_posts 需要 pages_read_user_content。
  // 官方文件錯誤代碼 283 寫明「requires pages_read_engagement and/or pages_read_user_content」,
  // 光有 pages_read_engagement 會回 code 10。別再把這個誤判成 pages_read_engagement 沒給。
  if (/pages_read_user_content/.test(e.message || '')) {
    return '權杖缺少 pages_read_user_content 權限,讀不到粉專的貼文清單。請在 Meta 應用程式的使用案例權限裡加上 pages_read_user_content,然後重新產生權杖。(這個權限用來讀粉專自己的貼文與其互動數,不是讀私人訊息。)';
  }
  if (e.code === 200 || e.code === 10) {
    return `權限不足。讀取貼文清單需要 pages_read_user_content(加上既有的 pages_read_engagement)。(${detail})`;
  }
  if (e.code === 100) return `要求的欄位或衡量指標無效,可能是該指標已被 Meta 停用。(${detail})`;
  return `Facebook 拒絕這次查詢:${detail}`;
}

async function graphGet(path, token, timeoutMs = 30000) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${path}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(readGraphError(payload, response.status));
    error.graphCode = payload?.error?.code;
    throw error;
  }
  return payload || {};
}

// 盡力補上觸及數字。沒有 read_insights 或指標被停用時回 null,不拋錯。
export async function fetchInsights(postId, token) {
  try {
    const payload = await graphGet(
      `${encodeURIComponent(postId)}/insights?metric=${POST_INSIGHT_METRICS.join(',')}`,
      token
    );
    const out = {};
    for (const item of payload.data || []) {
      const value = item?.values?.[0]?.value;
      if (typeof value === 'number') out[item.name] = value;
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: '僅接受 GET 或 POST。' });
  }

  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) {
    return res.status(503).json({
      error: '尚未啟用 FB 功能。請在 Vercel 設定 FB_PAGE_ID 與 FB_PAGE_ACCESS_TOKEN,然後重新部署。'
    });
  }

  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);
  if (denied) return res.status(denied.startsWith('尚未設定') ? 503 : 401).json({ error: denied });

  const limit = parseLimit(req.query?.limit ?? req.body?.limit);
  const wantInsights = String(req.query?.insights ?? req.body?.insights ?? '1') !== '0';

  // 洞察報告需要粉專權杖(用戶權杖讀不到),先解析。
  let token;
  try {
    ({ token } = await resolvePageToken(rawToken, pageId));
  } catch (error) {
    return res.status(502).json({ error: error?.message || '無法取得粉絲專頁權杖。' });
  }

  try {
    const payload = await graphGet(
      `${pageId}/published_posts?fields=${POST_FIELDS}&limit=${limit}`,
      token,
      45000
    );
    const posts = (payload.data || []).map(normalizePost).filter(Boolean);

    let insightsAvailable = false;
    if (wantInsights && posts.length) {
      // 只對最近 25 則取洞察,避免一次打太多次 Graph 讓函式超時。
      const slice = posts.slice(0, 25);
      const results = await Promise.all(slice.map((p) => fetchInsights(p.id, token)));
      results.forEach((insight, i) => {
        if (!insight) return;
        insightsAvailable = true;
        slice[i].reach = insight.post_total_media_view_unique ?? null;
        slice[i].views = insight.post_media_view ?? null;
      });
    }

    return res.status(200).json({
      ok: true,
      pageId,
      count: posts.length,
      insightsAvailable,
      insightsNote: insightsAvailable
        ? '觸及數字來自洞察報告(post_media_view / post_total_media_view_unique)。'
        : '沒有觸及數字:權杖缺 read_insights 權限、或持有人不能在粉專執行 ANALYZE 任務。按讚/留言/分享不受影響。',
      posts
    });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時,請重試。' : (error?.message || '查詢失敗,請重試。');
    return res.status(502).json({ error: msg });
  }
}
