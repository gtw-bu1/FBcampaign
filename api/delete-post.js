// 刪除粉專上一則「已發布」的貼文。不可回復,所以門檻刻意做高。
//
// 為什麼需要這支(2026-11-25):舊版排程把圖片直接丟 /photos 帶 scheduled_publish_time,
// 發出來是**相簿照片**不是動態貼文(貼文編號尾碼 == 照片 fbid、permalink 是 photo.php),
// 粉專訪客與同事都看不到。使用者要求把那種垃圾貼文刪掉。
//
// `scheduled-posts.js` 的 DELETE 刻意只准刪未公開的排程貼文(is_published=false),
// 不在那裡放寬成「什麼都能刪」——刪已發布貼文是另一回事,所以獨立一支、條件另外寫。
//
// 安全設計:
//   1. 沿用使用密碼那道門
//   2. 必須帶 confirm=DELETE,避免手滑或被亂連結觸發
//   3. 只接受數字格式的貼文編號,不讓輸入接進 Graph 的網址路徑
//   4. 刪之前先查一次並把那則的資訊回傳,讓呼叫方看得到自己刪了什麼
import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';

const GRAPH_VERSION = 'v27.0';

export function validPostId(raw) {
  return typeof raw === 'string' && /^\d{5,}(_\d{5,})?$/.test(raw.trim());
}

// 相簿照片型的貼文:貼文編號尾碼就是照片 fbid,permalink 是 photo.php。
// 刪這種要刪照片本身,刪貼文編號 Facebook 不一定收。
export function isAlbumPhotoPost(post) {
  if (!post) return false;
  const tail = String(post.id || '').split('_')[1] || '';
  const fbid = String((post.attachments?.data?.[0]?.url || '').match(/fbid=(\d+)/)?.[1] || '');
  return /photo\.php\?fbid=/.test(post.permalink_url || '') || Boolean(tail && fbid && tail === fbid);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: '僅接受 DELETE 或 POST。' });
  }

  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) return res.status(503).json({ error: '尚未設定 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN。' });

  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);
  if (denied) return res.status(denied.startsWith('尚未設定') ? 503 : 401).json({ error: denied });

  const id = String(req.query?.id ?? req.body?.id ?? '').trim();
  const confirm = String(req.query?.confirm ?? req.body?.confirm ?? '').trim();
  if (!validPostId(id)) return res.status(400).json({ error: '請給一個有效的貼文編號。' });
  if (confirm !== 'DELETE') {
    return res.status(400).json({ error: '刪除貼文不可回復,請帶 confirm=DELETE 再送一次。' });
  }

  let token;
  try {
    ({ token } = await resolvePageToken(rawToken, pageId));
  } catch (error) {
    return res.status(502).json({ error: error?.message || '無法取得粉絲專頁權杖。' });
  }

  const graph = async (path, method = 'GET') => {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000)
    });
    return { ok: response.ok, status: response.status, payload: await response.json().catch(() => null) };
  };

  try {
    const before = await graph(`${encodeURIComponent(id)}?fields=id,message,created_time,permalink_url,is_published,attachments{media_type,url}`);
    if (!before.ok) {
      return res.status(502).json({ error: `找不到這則貼文:${before.payload?.error?.message || `HTTP ${before.status}`}` });
    }
    const post = before.payload || {};
    const album = isAlbumPhotoPost(post);

    // 相簿照片型:刪照片本身(貼文編號的尾碼)
    const target = album ? (String(post.id || '').split('_')[1] || id) : id;
    const del = await graph(encodeURIComponent(target), 'DELETE');
    if (!del.ok) {
      return res.status(502).json({
        error: `刪除失敗:${del.payload?.error?.message || `HTTP ${del.status}`}`,
        tried: target, albumPhoto: album
      });
    }

    // 刪完回查一次,確認真的不在了
    const after = await graph(`${encodeURIComponent(id)}?fields=id`);
    return res.status(200).json({
      ok: true,
      deleted: target,
      albumPhoto: album,
      stillThere: after.ok,
      was: {
        id: post.id,
        createdTime: post.created_time,
        permalink: post.permalink_url,
        message: String(post.message || '').slice(0, 120)
      }
    });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時,請重試。' : (error?.message || '刪除失敗。');
    return res.status(502).json({ error: msg });
  }
}
