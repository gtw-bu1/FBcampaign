import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';

import { queueConfigured, queuePrefix, listPhotoJobs, cancelPhotoJob } from './_photo-queue.mjs';

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
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: '僅接受 GET、POST 或 DELETE。' });
  }

  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) {
    return res.status(503).json({ error: '尚未啟用 FB 功能。請在 Vercel 設定 FB_PAGE_ID 與 FB_PAGE_ACCESS_TOKEN。' });
  }

  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);
  if (denied) return res.status(denied.startsWith('尚未設定') ? 503 : 401).json({ error: denied });

  if (req.method === 'DELETE') {
    const id = String(req.query?.id ?? req.body?.id ?? '').trim();
    try {
      if (id.startsWith(queuePrefix)) {
        if (!await cancelPhotoJob(pageId, id.slice(queuePrefix.length))) {
          return res.status(409).json({ error: '這筆已取消或已進入發布程序，請重新查詢。' });
        }
        return res.status(200).json({ ok: true, deleted: id });
      }
      const { token } = await resolvePageToken(rawToken, pageId);
      return cancelScheduled(req, res, token);
    } catch {
      return res.status(502).json({ error: '無法確認取消結果，請重新查詢清單。' });
    }
  }

  const localEnabled = queueConfigured();
  const [local, facebook] = await Promise.allSettled([
    localEnabled ? listPhotoJobs(pageId) : [],
    listFacebookScheduled(pageId, rawToken)
  ]);
  if ((!localEnabled || local.status === 'rejected') && facebook.status === 'rejected') {
    return res.status(502).json({ error: '工具排程與 Facebook 排程皆無法讀取。' });
  }
  const posts = local.status === 'fulfilled' ? local.value.map(row => {
    const at = Date.parse(row.due_at) / 1000;
    return {
      id: queuePrefix + row.id, at, atText: taipeiTime(at), message: row.message,
      state: row.state, postId: row.post_id, source: 'tool', overdue: row.state === 'pending' && at < Date.now() / 1000
    };
  }) : [];
  if (facebook.status === 'fulfilled') posts.push(...facebook.value);
  posts.sort((x, y) => x.at - y.at);
  const warning = local.status === 'rejected' ? '工具排程暫時讀取失敗，以下只列 Facebook 排程。'
    : facebook.status === 'rejected' ? 'Facebook 排程暫時讀取失敗，以下只列工具排程。' : '';
  return res.status(200).json({ ok: true, count: posts.length, posts, warning });
}

async function listFacebookScheduled(pageId, rawToken) {
  const { token } = await resolvePageToken(rawToken, pageId);
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/scheduled_posts?fields=${FIELDS}&limit=50`,
    { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) }
  );
  if (!response.ok) throw new Error('無法讀取 Facebook 排程。');
  const payload = await response.json();
  return (payload.data || []).map(p => normalizeScheduled(p)).filter(Boolean);
}

// --- 取消排程 ---
//
// 只准刪「還沒公開」的貼文。刪已發布的貼文是不可回復的,而且使用者沒有要求這個功能,
// 所以刪之前一定先問 Facebook 這則的 is_published,是 true 就拒絕。
export function validPostId(raw) {
  return typeof raw === 'string' && /^\d{5,}(_\d{5,})?$/.test(raw.trim());
}

async function cancelScheduled(req, res, token) {
  const id = String(req.query?.id ?? req.body?.id ?? '').trim();
  if (!validPostId(id)) return res.status(400).json({ error: '請給一個有效的貼文編號。' });

  try {
    const probe = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(id)}?fields=id,is_published,scheduled_publish_time`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) }
    );
    const info = await probe.json().catch(() => null);
    if (!probe.ok) {
      return res.status(502).json({ error: `找不到這則貼文:${info?.error?.message || `HTTP ${probe.status}`}` });
    }
    if (info?.is_published !== false) {
      return res.status(409).json({
        error: '這則已經公開發布了,不是排程貼文。已發布的貼文不會從這裡刪除——要刪請到粉絲專頁上操作。'
      });
    }

    const del = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(id)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) }
    );
    const result = await del.json().catch(() => null);
    if (!del.ok) {
      return res.status(502).json({ error: `取消失敗:${result?.error?.message || `HTTP ${del.status}`}` });
    }
    return res.status(200).json({ ok: true, deleted: id });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時,請重試。' : (error?.message || '取消失敗。');
    return res.status(502).json({ error: msg });
  }
}
