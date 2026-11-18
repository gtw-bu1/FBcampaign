// 一鍵診斷:在瀏覽器打開就能看到「權杖到底哪裡不對」。
//
// 為什麼要這支:2026-11-18 排程發文失敗,但從外部只能看到「使用密碼不正確」
// (密碼門擋在前面),無從判斷是權杖類型、粉專編號還是權限的問題,
// 只能來回請使用者貼錯誤訊息。這支把所有判斷一次做完並列出來。
//
// 安全:**絕不回傳權杖本身**,只回傳它的長度、前 6 碼與判斷結果。
// 沿用同一道使用密碼門;在已登入的瀏覽器直接開網址即可(靠簽章 cookie)。
import { gate } from './_auth.mjs';

const GRAPH_VERSION = 'v27.0';

async function graph(path, token) {
  try {
    const r = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(15000) }
    );
    const payload = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, payload };
  } catch (e) {
    return { ok: false, status: 0, payload: { error: { message: e?.message || '連線失敗' } } };
  }
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 把診斷結果組成結論與建議。純函式,方便測試。
// 發文需要的粉專任務。權限(permissions)齊全但任務(tasks)不足,照樣發不出去。
export const NEEDED_TASKS = { CREATE_CONTENT: '發文與排程發文', ANALYZE: '讀取觸及數據' };

// 把排程貼文整理成「幾月幾號幾點、貼文開頭」的清單。
// 需要粉專權杖;出處 docs/graph-api/reference/page/scheduled_posts/
export function describeScheduled(scheduled) {
  if (!scheduled) return null;
  if (!scheduled.ok) return { error: scheduled.payload?.error?.message || `HTTP ${scheduled.status}` };
  const items = (scheduled.payload?.data || []).map((p) => ({
    id: p.id || '',
    at: p.scheduled_publish_time
      ? new Date(Number(p.scheduled_publish_time) * 1000).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
      : '(沒有時間)',
    message: (p.message || '').replace(/\s+/g, ' '),
    picture: p.full_picture || ''
  }));
  const list = items.map((p) => `${p.at}:${p.message.slice(0, 40) || '(無文字)'}`);
  return { list, items };
}

export function buildVerdict({ pageId, me, accounts, permissions, pageProbe, exchangedProbe, scheduled, postsProbe }) {
  const rows = [];
  const add = (label, value, state) => rows.push({ label, value, state });

  add('設定的粉專編號(FB_PAGE_ID)', pageId || '(未設定)', pageId ? 'ok' : 'bad');

  if (!me?.ok) {
    const e = me?.payload?.error;
    add('權杖身分', `讀不到:${e?.message || '未知錯誤'}`, 'bad');
    const advice = e?.code === 190
      ? '權杖已失效或過期,請重新產生一組。'
      : '權杖無效。請確認貼進 Vercel 時沒有多餘空白或換行,並確認它還沒過期。';
    return { rows, verdict: '權杖本身無法使用', advice, kind: 'invalid' };
  }

  const meId = String(me.payload?.id || '');
  const meName = me.payload?.name || '(無名稱)';
  const isPageToken = meId === String(pageId);
  add('權杖代表誰', `${meName}(編號 ${meId})`, 'info');
  add('權杖類型', isPageToken ? '粉絲專頁權杖 ✓' : '用戶權杖(個人身分)', isPageToken ? 'ok' : 'warn');

  if (permissions) {
    const granted = (permissions.payload?.data || []).filter((p) => p.status === 'granted').map((p) => p.permission);
    add('已授權的權限', granted.length ? granted.join('、') : '(讀不到,粉專權杖本來就讀不到這個,正常)', 'info');
    for (const need of ['pages_manage_posts', 'pages_read_engagement']) {
      if (granted.length && !granted.includes(need)) add(`缺少權限 ${need}`, '發文會失敗', 'bad');
    }
    // 2026-11-18 實測:讀粉專貼文清單需要這個,只有 pages_read_engagement 會被擋(code 10)
    if (granted.length && !granted.includes('pages_read_user_content')) {
      add('缺少權限 pages_read_user_content', '「讀取粉專成效」與成效預估會失敗(發文不受影響)', 'bad');
    }
    if (granted.length && !granted.includes('read_insights')) {
      add('沒有 read_insights', '按讚/留言/分享仍可讀,只是拿不到觸及人數', 'warn');
    }
  }

  if (isPageToken) {
    if (pageProbe?.ok) {
      add('用這個權杖讀粉專', `成功:${pageProbe.payload?.name || ''}`, 'ok');
      return {
        rows,
        verdict: '權杖正確,應該可以發文',
        advice: '如果發文還是失敗,請把錯誤訊息原文貼出來——那會是另一個原因(例如粉專角色不足,需要「編輯」以上才能 CREATE_CONTENT)。',
        kind: 'page'
      };
    }
    add('用這個權杖讀粉專', `失敗:${pageProbe?.payload?.error?.message || '未知'}`, 'bad');
    return { rows, verdict: '權杖是粉專權杖,但讀不到這個粉專', advice: '請確認 FB_PAGE_ID 填的是正確的粉專編號。', kind: 'page-mismatch' };
  }

  // 用戶權杖:看能不能換出粉專權杖
  if (!accounts?.ok) {
    add('能管理的粉專', `讀不到:${accounts?.payload?.error?.message || '未知'}`, 'bad');
    return {
      rows,
      verdict: '這是用戶權杖,而且無法換成粉專權杖',
      advice: '這組權杖缺少 pages_show_list 權限,所以系統沒辦法自動換取。請在 Graph API Explorer 的權限欄加上 pages_show_list,重新產生權杖;或直接把「用戶或粉絲專頁」選成該粉專,產出粉專權杖。',
      kind: 'user-no-list'
    };
  }

  const list = accounts.payload?.data || [];
  add('這個帳號能管理的粉專', list.length ? list.map((p) => `${p.name}(${p.id})`).join('、') : '一個都沒有', list.length ? 'info' : 'bad');

  const match = list.find((p) => String(p.id) === String(pageId));
  if (match?.access_token) {
    // 任務權限:這是「權限都有卻發不出去」最常見的原因
    const tasks = Array.isArray(match.tasks) ? match.tasks : null;
    if (tasks) {
      add('在這個粉專的任務權限', tasks.length ? tasks.join('、') : '(一個都沒有)', tasks.includes('CREATE_CONTENT') ? 'ok' : 'bad');
      const missing = Object.keys(NEEDED_TASKS).filter((t) => !tasks.includes(t));
      if (missing.includes('CREATE_CONTENT')) {
        return {
          rows,
          verdict: '權杖沒問題,但這個身分不能在粉專發文',
          advice: `缺少 CREATE_CONTENT 任務(${NEEDED_TASKS.CREATE_CONTENT})。請到 business.facebook.com 的企業設定,把這個系統使用者對該粉專的權限改成「管理粉絲專頁(完全控制)」,或在粉專的「粉專管理人」把角色提升到編輯以上,然後重新產生權杖。`,
          kind: 'no-create-content'
        };
      }
      if (missing.includes('ANALYZE')) {
        add('缺少 ANALYZE 任務', '拿不到觸及人數,按讚/留言/分享不受影響', 'warn');
      }
    } else {
      add('在這個粉專的任務權限', '(讀不到 tasks 欄位)', 'warn');
    }

    if (exchangedProbe) {
      const good = exchangedProbe.ok && String(exchangedProbe.payload?.id) === String(pageId);
      add('換取後的粉專權杖實測', good ? `成功,確認代表「${exchangedProbe.payload?.name || ''}」` : `失敗:${exchangedProbe.payload?.error?.message || '身分不符'}`, good ? 'ok' : 'bad');
      if (!good) {
        return {
          rows,
          verdict: '可以換到粉專權杖,但換出來的權杖不能代表粉專',
          advice: '這種情況少見。請把這一頁截圖提供給開發者。',
          kind: 'exchange-broken'
        };
      }
    }

    if (postsProbe) {
      const good = postsProbe.ok;
      const n = (postsProbe.payload?.data || []).length;
      add('讀取貼文清單實測', good ? `成功,讀到 ${n} 則` : `失敗:${postsProbe.payload?.error?.message || '未知'}`, good ? 'ok' : 'bad');
    }

    const sched = describeScheduled(scheduled);
    if (sched?.error) {
      add('目前的排程貼文', `讀不到:${sched.error}`, 'warn');
    } else if (sched) {
      add('目前的排程貼文', sched.list.length ? sched.list.join('  |  ') : '一則都沒有', sched.list.length ? 'ok' : 'warn');
      if (sched.list.length) {
        return {
          rows,
          verdict: `設定正確,而且粉專上已經有 ${sched.list.length} 則排程貼文`,
          advice: '排程已經成功進到 Facebook。在粉專的「規劃工具」要切到排程當天那一週才看得到(預設可能顯示別的週,按「今天」回到本週)。確認內容無誤後可以在那裡取消。',
          kind: 'has-scheduled'
        };
      }
    }

    return {
      rows,
      verdict: '設定正確,發文應該可以運作',
      advice: '所有檢查都通過,但粉專上目前沒有排程貼文,表示還沒成功送出過。請回工具按一次排程發布;若失敗請貼出錯誤訊息原文。',
      kind: 'user-exchangeable'
    };
  }

  if (!list.length) {
    return {
      rows,
      verdict: '這是用戶權杖,而且這個帳號沒有任何可管理的粉專',
      advice: '產生權杖的那個人在 Facebook 的認定裡不是這個粉專的「粉專人員」。請由真正能管理該粉專的人產生權杖,或請粉專管理員在「專業主控板 → 粉專管理人」把他加成編輯以上;若粉專歸在企業管理平台底下,請改用系統使用者權杖。',
      kind: 'user-no-pages'
    };
  }

  return {
    rows,
    verdict: '這是用戶權杖,但他管理的粉專裡沒有這個編號',
    advice: `設定的 FB_PAGE_ID 是 ${pageId},但這個帳號只能管理上面列出的粉專。請確認編號填對,或改用正確帳號產生權杖。`,
    kind: 'page-not-in-list'
  };
}

const STATE_COLOR = { ok: '#2f7d4f', warn: '#9a6a1e', bad: '#b34b34', info: '#444' };

export function renderScheduledCards(items = []) {
  if (!items.length) return '';
  const cards = items.map((p) => `<div class="post">
    ${p.picture ? `<img src="${escapeHtml(p.picture)}" alt="排程貼文圖片">` : '<div class="noimg">無圖片</div>'}
    <div class="postbody"><div class="postat">${escapeHtml(p.at)}</div>
    <div class="posttext">${escapeHtml(p.message || '(無文字)')}</div>
    <div class="postid">貼文編號 ${escapeHtml(p.id)}</div></div></div>`).join('');
  return `<h2>粉專上實際的排程貼文</h2>
  <p class="note">這是直接向 Facebook 查到的內容。看得到圖與文字,就表示已經成功排進去了,到時間會自動發布。</p>
  <div class="posts">${cards}</div>`;
}

export function renderHtml({ rows, verdict, advice, tokenHint, scheduledCards = '' }) {
  const items = rows.map((r) =>
    `<tr><th>${escapeHtml(r.label)}</th><td style="color:${STATE_COLOR[r.state] || '#444'}">${escapeHtml(r.value)}</td></tr>`
  ).join('');
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>FB 設定診斷</title><style>
body{font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;background:#f6f5f1;color:#302d28;margin:0;padding:28px}
.card{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e7e5df;border-radius:12px;padding:24px 26px}
h1{font-size:18px;margin:0 0 4px}.sub{font-size:11px;color:#a3998b;margin:0 0 18px}
.verdict{font-size:15px;font-weight:700;padding:12px 14px;background:#fbfaf7;border-radius:8px;margin-bottom:14px}
.advice{font-size:12px;line-height:1.9;background:#fff8ed;border:1px solid #f0e3cc;border-radius:8px;padding:12px 14px;margin-bottom:18px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;width:42%;padding:9px 0;color:#7b8674;font-weight:400;vertical-align:top;border-top:1px solid #f0efe9}
h2{font-size:14px;margin:26px 0 6px}
.note{font-size:11px;color:#7b8674;line-height:1.8;margin:0 0 12px}
.posts{display:flex;flex-direction:column;gap:12px}
.post{display:flex;gap:12px;border:1px solid #e7e5df;border-radius:10px;padding:12px;background:#fbfaf7}
.post img{width:120px;height:120px;object-fit:cover;border-radius:8px;flex:0 0 auto}
.noimg{width:120px;height:120px;border-radius:8px;background:#efede7;color:#a3998b;font-size:10px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.postbody{min-width:0}
.postat{font-size:13px;font-weight:700;color:#302d28;margin-bottom:6px}
.posttext{font-size:11px;line-height:1.8;color:#5f4333;max-height:90px;overflow:auto;word-break:break-word}
.postid{font-size:9px;color:#a3998b;margin-top:8px}
td{padding:9px 0;vertical-align:top;border-top:1px solid #f0efe9;word-break:break-all}
.foot{margin-top:18px;font-size:10px;color:#a3998b;line-height:1.8}
</style></head><body><div class="card">
<h1>Facebook 設定診斷</h1>
<p class="sub">這一頁不會顯示權杖內容,只顯示判斷結果。</p>
<div class="verdict">${escapeHtml(verdict)}</div>
<div class="advice"><strong>怎麼辦:</strong>${escapeHtml(advice)}</div>
<table>${items}</table>
${scheduledCards}
<p class="foot">權杖長度 ${escapeHtml(tokenHint)}。這頁是唯讀診斷,不會發布任何貼文。</p>
</div></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);

  const wantsHtml = String(req.headers?.accept || '').includes('text/html');
  const fail = (status, text) => {
    if (wantsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(status).send(renderHtml({ rows: [], verdict: text, advice: '先在工具畫面輸入過使用密碼,再回來開這一頁。', tokenHint: '-' }));
    }
    return res.status(status).json({ error: text });
  };

  if (denied) return fail(denied.startsWith('尚未設定') ? 503 : 401, denied);
  if (!pageId || !token) return fail(503, '尚未設定 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN。');

  const me = await graph('me?fields=id,name', token);
  const isPageToken = me.ok && String(me.payload?.id) === String(pageId);
  const [accounts, permissions, pageProbe] = await Promise.all([
    isPageToken ? Promise.resolve(null) : graph('me/accounts?fields=id,name,access_token,tasks&limit=100', token),
    graph('me/permissions', token),
    isPageToken ? graph(`${pageId}?fields=id,name`, token) : Promise.resolve(null)
  ]);

  // 真的用換到的粉專權杖打一次,確認它代表的是粉專本身(唯讀)
  let exchangedProbe = null;
  const exchanged = (accounts?.payload?.data || []).find((p) => String(p.id) === String(pageId));
  if (exchanged?.access_token) {
    exchangedProbe = await graph('me?fields=id,name', exchanged.access_token);
  }

  // 用粉專權杖讀排程貼文,直接回答「FB 上到底有沒有東西」(唯讀)
  let scheduled = null;
  let postsProbe = null;
  const pageToken = exchanged?.access_token || (isPageToken ? token : null);
  if (pageToken) {
    scheduled = await graph(`${pageId}/scheduled_posts?fields=id,message,scheduled_publish_time,full_picture&limit=25`, pageToken);
    // 實測「讀取粉專成效」會不會通,這是和發文不同的權限路徑
    postsProbe = await graph(`${pageId}/published_posts?fields=id&limit=3`, pageToken);
  }

  const result = buildVerdict({ pageId, me, accounts, permissions, pageProbe, exchangedProbe, scheduled, postsProbe });
  const tokenHint = `${token.length} 字元,開頭 ${token.slice(0, 6)}…`;

  if (wantsHtml) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const cards = renderScheduledCards(describeScheduled(scheduled)?.items || []);
    return res.status(200).send(renderHtml({ ...result, tokenHint, scheduledCards: cards }));
  }
  return res.status(200).json({ ok: true, ...result, tokenHint });
}
