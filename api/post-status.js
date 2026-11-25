// 查一則貼文在 Facebook 眼裡的真實狀態。唯讀。
//
// 為什麼要這支(2026-11-25):排程貼文到時間「發布」了,`published_posts` 也查得到它,
// 但使用者與同事在粉專上都看不到,只看得到手動發的那兩則。
// `published_posts` 查得到 ≠ 粉專訪客看得到——還要看 is_published / is_hidden /
// privacy / status_type。光看「有沒有出現在清單裡」會得到錯的結論。
//
// 另一條線索:那則的 permalink_url 是 `photo.php?fbid=…&set=a.<相簿>` (相簿照片),
// 手動發的兩則是 `/<page>/posts/<id>` (動態貼文)。同樣打 /photos 端點卻給出兩種網址,
// 差別只在有沒有帶 published=false + scheduled_publish_time。
import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';

const GRAPH_VERSION = 'v27.0';
const FIELDS = [
  'id', 'created_time', 'message', 'permalink_url',
  'is_published', 'is_hidden', 'is_expired', 'status_type',
  'privacy', 'from', 'attachments{media_type,type,url}',
  'promotable_id'
].join(',');

// 只允許 Graph 的貼文編號格式,避免把使用者輸入直接接進 URL 路徑。
export function validPostId(raw) {
  return typeof raw === 'string' && /^\d{5,}(_\d{5,})?$/.test(raw.trim());
}

// 把 Graph 回的欄位翻成一句「粉專上看得到嗎」的判斷。
export function readVisibility(post) {
  if (!post || typeof post !== 'object') return { visible: false, why: '查不到這則貼文。' };
  const published = post.is_published !== false;
  const hidden = post.is_hidden === true;
  const privacyValue = post.privacy?.value || '';
  const publicPrivacy = !privacyValue || privacyValue === 'EVERYONE' || privacyValue === '';
  const isAlbumPhoto = /photo\.php\?fbid=/.test(post.permalink_url || '');

  if (!published) return { visible: false, why: '這則還是未發布狀態(is_published=false),所以沒有人看得到。' };
  if (hidden) return { visible: false, why: '這則被標為「從粉專動態隱藏」(is_hidden=true),訪客看不到,只有管理員在後台看得到。' };
  if (!publicPrivacy) return { visible: false, why: `這則的隱私設定是 ${privacyValue},不是公開。` };
  if (isAlbumPhoto) {
    return {
      visible: 'album',
      why: '這則是「相簿照片」而不是粉專動態貼文(網址是 photo.php?fbid=…&set=a.<相簿>)。'
        + '照片本身存在,但粉專動態上不會像一般貼文那樣出現,訪客幾乎不會看到。'
    };
  }
  return { visible: true, why: '已公開發布,訪客應該看得到。' };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: '僅接受 GET 或 POST。' });
  }

  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) return res.status(503).json({ error: '尚未設定 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN。' });

  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);
  if (denied) return res.status(denied.startsWith('尚未設定') ? 503 : 401).json({ error: denied });

  const id = String(req.query?.id ?? req.body?.id ?? '').trim();
  if (!validPostId(id)) return res.status(400).json({ error: '請給一個有效的貼文編號(例如 284455941624148_1572308271600147)。' });

  let token;
  try {
    ({ token } = await resolvePageToken(rawToken, pageId));
  } catch (error) {
    return res.status(502).json({ error: error?.message || '無法取得粉絲專頁權杖。' });
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${encodeURIComponent(id)}?fields=${FIELDS}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return res.status(502).json({ error: `讀不到這則貼文:${payload?.error?.message || `HTTP ${response.status}`}` });
    }
    return res.status(200).json({ ok: true, post: payload, ...readVisibility(payload) });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時,請重試。' : (error?.message || '查詢失敗。');
    return res.status(502).json({ error: msg });
  }
}
