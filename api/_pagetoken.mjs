// 把「不管拿到哪種權杖」都轉成可用的粉絲專頁權杖。
//
// 為什麼需要這支:2026-11-18 實測,主管從 Graph API Explorer 產的是**用戶權杖**,
// 拿它發排程貼文會被 Facebook 擋下:
//   (#200) Unpublished posts must be posted to a page as the page itself.
// 排程貼文(published=false)必須以粉專身分發,用戶權杖不行。
//
// 做法:先問這個權杖是誰。
//   /me 回的 id == FB_PAGE_ID  → 本來就是粉專權杖,直接用
//   /me 回的 id 是某個人       → 用戶權杖,去 /me/accounts 換出該粉專的權杖
//
// 換取需要用戶權杖帶 pages_show_list。換不到就回明確錯誤,不要默默失敗。
//
// 注意:從短期用戶權杖換來的粉專權杖,壽命跟著用戶權杖(約一兩個月)。
// 長期用請改用 Business Manager 的系統使用者權杖,那種不會過期。

const GRAPH_VERSION = 'v27.0';

// Vercel 的函式實例會重用(warm start),把結果快取起來避免每次請求都多打兩次 Graph。
let cache = null;

export function resetTokenCache() {
  cache = null;
}

async function graphGet(path, token, timeoutMs = 15000) {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(timeoutMs) }
  );
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, payload };
}

// 回傳 { token, kind } ;kind 是 'page'(本來就是)或 'exchanged'(從用戶權杖換來)。
// 失敗時丟出帶有可行動訊息的 Error。
export async function resolvePageToken(rawToken, pageId, { fetchImpl } = {}) {
  if (!rawToken || !pageId) throw new Error('缺少 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN。');
  if (cache && cache.rawToken === rawToken && cache.pageId === pageId) return { token: cache.token, kind: cache.kind };

  const get = fetchImpl || graphGet;

  const me = await get('me?fields=id,name', rawToken);
  if (!me.ok) {
    const e = me.payload?.error;
    if (e?.code === 190) throw new Error(`權杖已失效或過期,需要重新產生存取權杖。(${e.message || ''})`);
    throw new Error(`無法驗證權杖身分:${e?.message || `HTTP ${me.status}`}`);
  }

  // 已經是粉專權杖,最理想的情況
  if (String(me.payload?.id) === String(pageId)) {
    cache = { rawToken, pageId, token: rawToken, kind: 'page' };
    return { token: rawToken, kind: 'page' };
  }

  // 是用戶權杖,去換粉專權杖
  const accounts = await get('me/accounts?fields=id,name,access_token&limit=100', rawToken);
  if (!accounts.ok) {
    const e = accounts.payload?.error;
    throw new Error(
      `這是「${me.payload?.name || '某個人'}」的用戶權杖,不是粉絲專頁權杖,而且無法換取:${e?.message || `HTTP ${accounts.status}`}。` +
      '請改用粉絲專頁權杖(Graph API Explorer 的「用戶或粉絲專頁」要選粉專),或讓權杖帶 pages_show_list 權限。'
    );
  }

  const match = (accounts.payload?.data || []).find((p) => String(p.id) === String(pageId));
  if (!match?.access_token) {
    const names = (accounts.payload?.data || []).map((p) => `${p.name}(${p.id})`).join('、') || '(一個都沒有)';
    throw new Error(
      `這是「${me.payload?.name || '某個人'}」的用戶權杖,而且他管理的粉專裡找不到編號 ${pageId}。` +
      `這個帳號能管理的粉專:${names}。請確認 FB_PAGE_ID 正確,或改用該粉專的管理者帳號產生權杖。`
    );
  }

  cache = { rawToken, pageId, token: match.access_token, kind: 'exchanged' };
  return { token: match.access_token, kind: 'exchanged' };
}
