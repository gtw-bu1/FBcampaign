// 活動貼文清單:標題 + 獎勵內容 + 留言數。
//
// 規格來自 2026-11-19 使用者的明確指示:
//   「只要看我貼文文案中有『活動獎勵』這四個字,然後撈出那篇貼文的
//     第一行、獎勵內容、和留言數。這樣我就知道這個活動有留言就送 +
//     留言就抽 兩種獎勵方式,最後留言有多少則。先做這樣!先抓出來。」
//
// 所以這一版刻意只做抓取與呈現。獎勵魅力度、發放方式分類、與留言數的
// 關聯分析是**下一步**,不在這裡做。
//
// **Facebook API 不提供「活動參與人數」**(那是遊戲後台的資料),
// 欄位誠實標為「留言數」。
import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';
import { normalizePost, graphGetAll } from './page-insights.js';
import { hasRewardField, toActivityRow, activityCsv } from '../src/activity-extract.mjs';

const POST_FIELDS = [
  'id', 'message', 'created_time', 'permalink_url',
  'reactions.summary(true).limit(0)', 'comments.summary(true).limit(0)', 'shares'
].join(',');

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function sinceSeconds(months, now = Date.now()) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return Math.floor(d.getTime() / 1000);
}

function renderHtml({ rows, months, scanned, truncated, csvUrl }) {
  const row = (r) => `<tr>
    <td class="d">${escapeHtml(r.date)}</td>
    <td class="t">${escapeHtml(r.title) || '—'}</td>
    <td class="rw">${r.rewards.length
      ? r.rewards.map((x) => `<div>${escapeHtml(x.name)}</div>`).join('')
      : '<span class="dim">（抓不到獎勵內容）</span>'}</td>
    <td class="dv">${r.rewards.length
      ? r.rewards.map((x) => `<div class="${x.delivery === '留言就抽' ? 'draw' : x.delivery === '留言就送' ? 'give' : 'dim'}">${escapeHtml(x.delivery)}</div>`).join('')
      : '<span class="dim">—</span>'}</td>
    <td class="n hi">${r.comments}</td>
    <td class="n">${r.reactions}</td>
    <td class="n">${r.shares}</td>
    <td class="lk">${r.permalink ? `<a href="${escapeHtml(r.permalink)}" target="_blank" rel="noreferrer">看貼文</a>` : ''}</td>
  </tr>`;

  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>活動貼文 × 留言數</title><style>
body{font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;background:#f6f5f1;color:#302d28;margin:0;padding:26px}
.wrap{max-width:1100px;margin:0 auto}
h1{font-size:19px;margin:0 0 4px}
.sub{font-size:11px;color:#a3998b;margin:0 0 14px;line-height:1.8}
.note{font-size:11px;line-height:1.9;background:#fff8ed;border:1px solid #f0e3cc;border-radius:8px;padding:11px 13px;margin-bottom:16px}
.card{background:#fff;border:1px solid #e7e5df;border-radius:12px;padding:16px 18px;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:12px}
th{text-align:left;padding:9px 8px;color:#7b8674;font-weight:400;border-bottom:1px solid #e7e5df;white-space:nowrap}
td{padding:11px 8px;border-bottom:1px solid #f6f5f1;vertical-align:top}
td.d{white-space:nowrap;color:#7b8674;font-size:11px}
td.t{font-weight:700;min-width:190px;line-height:1.6}
td.rw{line-height:1.8;min-width:280px}
td.rw div{padding:1px 0}
td.dv{white-space:nowrap;line-height:1.8}
td.dv div{padding:1px 0}
td.dv .draw{color:#9a6a1e;font-weight:700}
td.dv .give{color:#2f7d4f;font-weight:700}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.hi{font-weight:800;font-size:15px;color:#302d28}
td.lk a{font-size:10px;color:#7b8674}
.dim{color:#c4bcae}
a.dl{display:inline-block;background:#38372f;color:#fff;border-radius:7px;padding:9px 16px;font-size:12px;text-decoration:none;margin-bottom:14px}
.empty{font-size:12px;color:#b34b34;background:#fff3f0;border-radius:8px;padding:12px 14px}
</style></head><body><div class="wrap">
<h1>活動貼文 × 留言數</h1>
<p class="sub">最近 ${months} 個月共掃過 ${scanned} 則貼文,其中 <strong>${rows.length} 則</strong>文案含「活動獎勵」${truncated ? '(已達分頁上限,可能還有更舊的貼文沒抓到)' : ''}。依發布日期由新到舊排列。</p>
<div class="note"><strong>「留言數」不等於活動參與人數</strong>——Facebook API 不提供參與人數(那在遊戲後台)。
對「留言參加」型的活動,留言數是合理的代理指標。<br>
獎勵名稱是從「活動獎勵」之後的每一行清出來的(去掉「參與活動即可獲得」這類描述與「每帳號限領 1 次」這種名額附註,
但<strong>保留「（7天）」「（永久）」</strong>,因為那是獎勵屬性)。<br>
<strong>發放方式</strong>:出現「抽出/抽獎」算<span style="color:#9a6a1e;font-weight:700">留言就抽</span>,
出現「即可獲得/限領」算<span style="color:#2f7d4f;font-weight:700">留言就送</span>,兩者都沒有就標「未標示」。
同一個活動常常兩種都有,所以會看到兩行。</div>
<p><a class="dl" href="${escapeHtml(csvUrl)}">⤓ 下載 CSV(Excel 可直接開)</a></p>
<div class="card">${rows.length
    ? `<table><thead><tr><th>日期</th><th>活動標題（第一行）</th><th>獎勵名稱</th><th>發放方式</th><th>留言</th><th>心情</th><th>分享</th><th></th></tr></thead><tbody>${rows.map(row).join('')}</tbody></table>`
    : `<p class="empty">最近 ${months} 個月掃過的 ${scanned} 則貼文裡,沒有一則文案含「活動獎勵」四個字。可以把 months 調大(例如網址加 ?months=36),或告訴我你們活動貼文實際的欄位寫法。</p>`}</div>
</div></body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;
  const wantsCsv = String(req.query?.format || '') === 'csv';
  const wantsHtml = !wantsCsv && String(req.headers?.accept || '').includes('text/html');

  const fail = (status, text) => {
    if (wantsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(status).send(`<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:30px;line-height:1.9">
        <h2>還不能產生報表</h2><p>${escapeHtml(text)}</p>
        <p style="font-size:12px;color:#777">先在工具畫面輸入過使用密碼,再回來開這一頁。</p></body>`);
    }
    return res.status(status).json({ error: text });
  };

  if (!pageId || !rawToken) return fail(503, '尚未設定 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN。');
  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);
  if (denied) return fail(denied.startsWith('尚未設定') ? 503 : 401, denied);

  const months = Math.min(Math.max(Number.parseInt(req.query?.months, 10) || 24, 1), 36);

  let token;
  try {
    ({ token } = await resolvePageToken(rawToken, pageId));
  } catch (error) {
    return fail(502, error?.message || '無法取得粉絲專頁權杖。');
  }

  try {
    const { data, truncated } = await graphGetAll(
      `${pageId}/published_posts?fields=${POST_FIELDS}&limit=100&since=${sinceSeconds(months)}`,
      token,
      { timeoutMs: 45000 }
    );
    const all = data.map(normalizePost).filter(Boolean);
    const rows = all
      .filter((p) => hasRewardField(p.message))
      .map(toActivityRow)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (wantsCsv) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="fb-activity-${months}m.csv"`);
      return res.status(200).send(activityCsv(rows));
    }

    if (wantsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(renderHtml({
        rows, months, scanned: all.length, truncated,
        csvUrl: `/api/reward-report?months=${months}&format=csv`
      }));
    }
    return res.status(200).json({ ok: true, months, scanned: all.length, count: rows.length, truncated, rows });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時,請重試。' : (error?.message || '查詢失敗,請重試。');
    return fail(502, msg);
  }
}
