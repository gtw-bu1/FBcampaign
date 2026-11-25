// 一鍵發布到 Facebook 粉絲專頁
//
// 只能發粉絲專頁。個人頁面發文的 publish_actions 權限 Meta 已於 2018-04-24 移除,
// 第三方應用程式無法發文到個人檔案,這條路不存在。
//
// 需要的環境變數(都設在 Vercel,不要進程式碼):
//   FB_PAGE_ID               粉絲專頁編號
//   FB_PAGE_ACCESS_TOKEN     粉絲專頁存取權杖(建議用 Business Manager 的系統用戶權杖,不會過期)
//   FB_CAMPAIGN_ACCESS_CODE  沿用現有的使用密碼,擋住非自己人
//
// 權杖需要的權限:pages_manage_posts(發文)與 pages_read_engagement。
// 官方的貼文指南列了四個(另含 pages_manage_engagement、pages_read_user_engagement),
// 但那是「發文 + 留言 + 互動」全部操作的集合;本端點只打 /feed 與 /photos,前兩個就夠。
// 注意:應用程式主控板「管理粉絲專頁所有內容」使用案例的清單裡沒有
// pages_read_user_engagement 這一項(2026-11-17 實際操作),找不到就跳過,不要改加
// pages_read_user_content——那是讀別人的留言內容,本工具不需要。
// 操作者必須能在該粉絲專頁執行 CREATE_CONTENT / MANAGE / MODERATE 任務。
import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';

const GRAPH_VERSION = 'v27.0';
const MAX_MESSAGE_CHARS = 20000;
const MAX_IMAGE_BASE64_CHARS = 8_000_000;   // 約 6MB 原始檔
const SCHEDULE_MIN_SECONDS = 10 * 60;        // 官方規定:最早 10 分鐘後
const SCHEDULE_MAX_SECONDS = 30 * 24 * 60 * 60; // 官方規定:最晚 30 天內

export function scheduleWindow(nowSeconds) {
  return { min: nowSeconds + SCHEDULE_MIN_SECONDS, max: nowSeconds + SCHEDULE_MAX_SECONDS };
}

// 回傳錯誤訊息字串;沒問題回空字串。純函式,方便測試。
export function validatePublishRequest(body, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!body || typeof body !== 'object') return '請求格式不正確。';
  const { message, imageDataUrl, link, scheduledPublishTime } = body;
  if (typeof message !== 'string' || !message.trim()) return '貼文內容不可為空。';
  if (message.length > MAX_MESSAGE_CHARS) return `貼文內容過長(上限 ${MAX_MESSAGE_CHARS} 字)。`;
  if (imageDataUrl !== undefined) {
    if (typeof imageDataUrl !== 'string' || !/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) {
      return '圖片格式不正確,只接受 JPEG 或 PNG 的 data URL。';
    }
    if (imageDataUrl.length > MAX_IMAGE_BASE64_CHARS) return '圖片過大,請降低畫質或改用 JPEG。';
  }
  if (link !== undefined && (typeof link !== 'string' || !/^https:\/\/[^\s]+$/.test(link))) {
    return '連結必須是 https 開頭的網址。';
  }
  if (scheduledPublishTime !== undefined) {
    if (!Number.isInteger(scheduledPublishTime)) return '排程時間必須是 UNIX 秒數整數。';
    const { min, max } = scheduleWindow(nowSeconds);
    if (scheduledPublishTime < min) return '排程時間必須至少在 10 分鐘之後(Facebook 的規定)。';
    if (scheduledPublishTime > max) return '排程時間不能超過 30 天之後(Facebook 的規定)。';
  }
  return '';
}

// 把 data URL 拆成 MIME 與位元組
export function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) return null;
  return { mime: match[1], bytes: Buffer.from(match[2], 'base64'), ext: match[1] === 'image/png' ? 'png' : 'jpg' };
}

// 從 Graph API 的錯誤回應擠出一句看得懂的話
export function readGraphError(payload, status) {
  const e = payload?.error;
  if (!e) return `Facebook 回應異常(HTTP ${status})。`;
  const parts = [e.message, e.error_user_msg].filter(Boolean);
  const detail = parts.join(' / ') || `代碼 ${e.code ?? '未知'}`;
  if (e.code === 190) return `權杖已失效或過期,需要重新產生粉絲專頁存取權杖。(${detail})`;
  if (e.code === 200 && /as the page itself|page itself/i.test(e.message || '')) {
    return `這是用戶權杖,不是粉絲專頁權杖——排程貼文必須以粉專身分發布。請改用粉絲專頁權杖,或讓權杖帶 pages_show_list 讓系統自動換取。(${detail})`;
  }
  if (e.code === 200 || e.code === 10) return `權限不足,請確認權杖有 pages_manage_posts 且操作者可在該專頁 CREATE_CONTENT。(${detail})`;
  if (e.code === 368) return `此專頁暫時被限制發文。(${detail})`;
  return `Facebook 拒絕這次發布:${detail}`;
}

async function graph(path, { token, json, form, timeoutMs = 60000 }) {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : form,
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(readGraphError(payload, response.status));
  return payload || {};
}

// --- 貼文網址 ---
//
// 2026-11-25 使用者:「顯示『已發布到粉絲專頁:https://www.facebook.com/284455941624148_1579963497501291』
// 但是並沒有發布」。實際查 Graph 的 published_posts,那則**真的發出去了**
// (2026-11-25 15:00:43 台北)。壞的是這個網址:
// `facebook.com/<粉專編號>_<貼文編號>` 不是 Facebook 認得的路徑,點進去看不到貼文,
// 於是看起來像沒發成功——她因此又按了一次,粉專上多出一則重複貼文。
//
// 正解是跟 Graph 要 `permalink_url`(那是 Facebook 自己給的網址)。
// 實測同一則貼文的 permalink_url 是
// `https://www.facebook.com/1572421051588869/posts/1579963497501291`——
// 前面那串**不是 FB_PAGE_ID**,所以不能自己拼,一定要問 Graph。
export function fallbackPermalink(pageId, postId) {
  const id = String(postId || '');
  if (!id) return '';
  const tail = id.includes('_') ? id.split('_')[1] : id;
  if (!tail) return '';
  return `https://www.facebook.com/${pageId}/posts/${tail}`;
}

// 問 Graph 這則貼文的正式網址。拿不到就回空字串,絕不自己編一個會 404 的網址。
export async function fetchPermalink(postId, token, timeoutMs = 15000) {
  if (!postId) return '';
  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(postId)}?fields=permalink_url`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(timeoutMs) }
    );
    if (!response.ok) return '';
    const payload = await response.json().catch(() => null);
    const url = payload?.permalink_url;
    return typeof url === 'string' && /^https:\/\/(www\.)?facebook\.com\//.test(url) ? url : '';
  } catch {
    return '';
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: '僅接受 POST。' });

  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) {
    return res.status(503).json({ error: '尚未啟用 FB 發布。請在 Vercel 設定 FB_PAGE_ID 與 FB_PAGE_ACCESS_TOKEN,然後重新部署。' });
  }

  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);
  if (denied) return res.status(denied.startsWith('尚未設定') ? 503 : 401).json({ error: denied });

  const body = typeof req.body === 'string'
    ? (() => { try { return JSON.parse(req.body); } catch { return null; } })()
    : req.body;

  const problem = validatePublishRequest(body);
  if (problem) return res.status(400).json({ error: problem });

  const { message, imageDataUrl, link, scheduledPublishTime } = body;
  const scheduled = Number.isInteger(scheduledPublishTime);

  // 排程貼文必須以粉專身分發布,所以一律先把權杖解析成粉專權杖。
  let token;
  try {
    ({ token } = await resolvePageToken(rawToken, pageId));
  } catch (error) {
    return res.status(502).json({ error: error?.message || '無法取得粉絲專頁權杖。' });
  }

  try {
    let result;
    if (imageDataUrl) {
      // 有圖:走 /photos,用 multipart 直接把位元組送上去。
      // 不用 url 參數,因為那要求圖片先有公開可存取的網址;我們的圖是前端現做的。
      const decoded = decodeDataUrl(imageDataUrl);
      if (!decoded) return res.status(400).json({ error: '圖片解析失敗。' });
      const form = new FormData();
      form.append('caption', message);
      form.append('source', new Blob([decoded.bytes], { type: decoded.mime }), `poster.${decoded.ext}`);
      if (scheduled) {
        form.append('published', 'false');
        form.append('scheduled_publish_time', String(scheduledPublishTime));
      }
      result = await graph(`${pageId}/photos`, { token, form, timeoutMs: 120000 });
    } else {
      const json = { message, ...(link ? { link } : {}) };
      if (scheduled) { json.published = false; json.scheduled_publish_time = scheduledPublishTime; }
      result = await graph(`${pageId}/feed`, { token, json });
    }

    const postId = result.post_id || result.id || '';

    // 排程貼文還沒公開,Graph 不會給 permalink_url,就不要給網址(給了也打不開)。
    let permalink = '';
    if (postId && !scheduled) {
      permalink = await fetchPermalink(postId, token) || fallbackPermalink(pageId, postId);
    }

    return res.status(200).json({
      ok: true,
      scheduled,
      postId,
      permalink,
      message: scheduled ? '已排程,時間到會自動發布。' : '已發布到粉絲專頁。'
    });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時,請重試。' : (error?.message || '發布失敗,請重試。');
    return res.status(502).json({ error: msg });
  }
}
