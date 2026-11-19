// 活動獎勵 ↔ 互動對照報表。
//
// 使用者 2026-11-19 的需求:「依照這兩年貼文有提到的『活動獎勵』其『參與人數』做一個表格」。
//
// **重要的事實澄清(已反映在欄位名稱上):**
// Facebook API **不提供「活動參與人數」**——那是遊戲後台的資料。
// Graph API 只給心情數、留言數、分享數。本報表因此把欄位誠實標為「留言數」,
// 不寫成「參與人數」。對「留言參加」型的活動,留言數是參與人數的合理代理指標,
// 但兩者不相等(有人在遊戲內參加卻沒留言,也有人留言多次)。
//
// 真正的「最終參與人數」在使用者原本手動維護的 CSV(src/performance.mjs 的
// HISTORY_HEADERS),那份要自己填。這張報表是用來補那份資料的材料。
import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';
import { normalizePost, readGraphError, graphGetAll } from './page-insights.js';
import { classifyPost, typeLabel } from '../src/post-types.mjs';
import { toRewardRow, rewardCsv } from '../src/reward-extract.mjs';
import { median } from '../src/post-forecast.mjs';

const POST_FIELDS = [
  'id', 'message', 'created_time', 'permalink_url', 'full_picture',
  'reactions.summary(true).limit(0)', 'comments.summary(true).limit(0)', 'shares'
].join(',');

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 幾個月前的 UNIX 秒,給 Graph 的 since 參數用
export function sinceSeconds(months, now = Date.now()) {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return Math.floor(d.getTime() / 1000);
}

// 按獎勵內容彙總:同一種獎勵出現幾次、留言中位數多少。
// 這是回答「哪種獎勵最能帶來參與」的核心。
export function groupByReward(rows = []) {
  const groups = new Map();
  for (const r of rows) {
    const key = (r.reward || '(文案沒寫獎勵)').slice(0, 30);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return Array.from(groups.entries())
    .map(([reward, list]) => ({
      reward,
      count: list.length,
      medianComments: median(list.map((r) => r.comments)),
      medianEngagement: median(list.map((r) => r.engagement)),
      maxComments: Math.max(...list.map((r) => r.comments)),
      dates: list.map((r) => r.date).filter(Boolean).sort()
    }))
    .sort((a, b) => (b.medianComments ?? 0) - (a.medianComments ?? 0));
}

function renderHtml({ rows, byReward, months, truncated, insightsNote, csvUrl }) {
  const typeRow = (r) => `<tr>
    <td>${escapeHtml(r.date)}</td>
    <td>${escapeHtml(typeLabel(r.typeId))}</td>
    <td>${escapeHtml(r.reward || '—')}</td>
    <td class="n">${r.quantity ?? '—'}</td>
    <td>${escapeHtml(r.period || '—')}</td>
    <td class="n hi">${r.comments}</td>
    <td class="n">${r.reactions}</td>
    <td class="n">${r.shares}</td>
    <td class="n">${r.engagement}</td>
    <td>${escapeHtml(r.excerpt)}</td>
  </tr>`;

  const rewardRow = (g) => `<tr>
    <td>${escapeHtml(g.reward)}</td>
    <td class="n">${g.count}</td>
    <td class="n hi">${g.medianComments}</td>
    <td class="n">${g.maxComments}</td>
    <td class="n">${g.medianEngagement}</td>
  </tr>`;

  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>活動獎勵 × 互動對照表</title><style>
body{font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;background:#f6f5f1;color:#302d28;margin:0;padding:26px}
.wrap{max-width:1180px;margin:0 auto}
h1{font-size:19px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 8px}
.sub{font-size:11px;color:#a3998b;margin:0 0 16px;line-height:1.8}
.warn{font-size:12px;line-height:1.9;background:#fff8ed;border:1px solid #f0e3cc;border-radius:8px;padding:12px 14px;margin-bottom:18px}
.card{background:#fff;border:1px solid #e7e5df;border-radius:12px;padding:18px 20px;margin-bottom:18px;overflow-x:auto}
table{width:100%;border-collapse:collapse;font-size:11px}
th{text-align:left;padding:8px 7px;color:#7b8674;font-weight:400;border-bottom:1px solid #e7e5df;white-space:nowrap}
td{padding:8px 7px;border-bottom:1px solid #f6f5f1;vertical-align:top}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
td.hi{font-weight:700;color:#302d28}
a.dl{display:inline-block;background:#38372f;color:#fff;border-radius:7px;padding:9px 16px;font-size:12px;text-decoration:none}
.empty{font-size:12px;color:#b34b34;background:#fff3f0;border-radius:8px;padding:12px 14px}
</style></head><body><div class="wrap">
<h1>活動獎勵 × 互動對照表</h1>
<p class="sub">資料來源:粉絲專頁最近 ${months} 個月的已發布貼文,共 ${rows.length} 則${truncated ? '(已達分頁上限,可能還有更舊的貼文沒抓到)' : ''}。${escapeHtml(insightsNote || '')}</p>
<div class="warn"><strong>欄位說明:</strong>Facebook API <strong>不提供「活動參與人數」</strong>(那是遊戲後台的資料),
只給心情、留言、分享。本表的「<strong>留言數</strong>」對「留言參加」型的活動可以當參與人數的代理指標,
但兩者不相等——有人在遊戲內參加卻沒留言,也有人留言多次。<br>
「活動獎勵」「活動檔期」是從貼文文案裡抓出來的;顯示 <strong>—</strong> 表示那則貼文沒有用
「活動獎勵:」這種欄位寫法,不是沒有獎勵。</div>
<p><a class="dl" href="${escapeHtml(csvUrl)}">⤓ 下載 CSV(可直接用 Excel 開)</a></p>

<h2>按獎勵彙總:哪種獎勵帶來最多留言</h2>
<div class="card">${byReward.length
    ? `<table><thead><tr><th>活動獎勵</th><th>則數</th><th>留言中位數</th><th>留言最高</th><th>互動中位數</th></tr></thead><tbody>${byReward.map(rewardRow).join('')}</tbody></table>`
    : '<p class="empty">沒有抓到任何貼文。</p>'}</div>

<h2>逐則明細</h2>
<div class="card">${rows.length
    ? `<table><thead><tr><th>發布日期</th><th>類型</th><th>活動獎勵</th><th>數量</th><th>活動檔期</th><th>留言</th><th>心情</th><th>分享</th><th>互動</th><th>文案開頭</th></tr></thead><tbody>${rows.map(typeRow).join('')}</tbody></table>`
    : '<p class="empty">沒有抓到任何貼文。</p>'}</div>
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
  const onlyType = String(req.query?.type || '').trim();

  let token;
  try {
    ({ token } = await resolvePageToken(rawToken, pageId));
  } catch (error) {
    return fail(502, error?.message || '無法取得粉絲專頁權杖。');
  }

  try {
    const since = sinceSeconds(months);
    const { data, truncated } = await graphGetAll(
      `${pageId}/published_posts?fields=${POST_FIELDS}&limit=100&since=${since}`,
      token,
      { timeoutMs: 45000 }
    );
    let rows = data
      .map(normalizePost)
      .filter(Boolean)
      .map((p) => toRewardRow({ ...p, typeId: classifyPost(p.message).id }, classifyPost));

    if (onlyType) rows = rows.filter((r) => r.typeId === onlyType);
    rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    if (wantsCsv) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="fb-reward-report-${months}m.csv"`);
      return res.status(200).send(rewardCsv(rows, typeLabel));
    }

    const byReward = groupByReward(rows.filter((r) => r.typeId === 'comment-driven' || r.reward));
    const base = `/api/reward-report?months=${months}${onlyType ? `&type=${encodeURIComponent(onlyType)}` : ''}`;

    if (wantsHtml) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(renderHtml({
        rows, byReward, months, truncated,
        insightsNote: '',
        csvUrl: `${base}&format=csv`
      }));
    }
    return res.status(200).json({ ok: true, months, count: rows.length, truncated, byReward, rows });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時,請重試。' : (error?.message || '查詢失敗,請重試。');
    return fail(502, msg);
  }
}
