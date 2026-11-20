// 一鍵更新預估基準:重新拉粉專貼文,算出新的基準表回傳。
//
// 為什麼不寫檔:Vercel 的檔案系統是唯讀的。所以更新後的基準由前端存在
// 瀏覽器(localStorage),面板優先用它,沒有才用打包進去的那份。
// 這個工具是單人用的,這樣最簡單也夠用。
//
// 獎勵品類對照(王牌角色、超越武器…)由前端一起送上來:
// 內建那幾筆加上營運自己補的,因為那是只有營運做得了的判斷。
import { gate } from './_auth.mjs';
import { resolvePageToken } from './_pagetoken.mjs';
import { normalizePost, graphGetAll } from './page-insights.js';
import { buildBaseline } from '../src/baseline-build.mjs';
import { BUILTIN_ALIASES, REWARD_CATEGORIES } from '../src/reward-aliases.mjs';
import { sinceSeconds } from './reward-report.js';

const POST_FIELDS = [
  'id', 'message', 'created_time', 'permalink_url',
  'reactions.summary(true).limit(0)', 'comments.summary(true).limit(0)', 'shares'
].join(',');

export function mergeAliases(extra) {
  const list = [...BUILTIN_ALIASES];
  if (!Array.isArray(extra)) return list;
  for (const a of extra) {
    const from = String(a?.from ?? '').trim();
    const to = String(a?.to ?? '').trim();
    if (!from || from.length > 60) continue;
    if (!REWARD_CATEGORIES.includes(to)) continue;   // 只接受既有品類,不讓前端塞任意字串
    const at = list.findIndex((x) => x.from === from);
    if (at < 0) list.push({ from, to });
    else list[at] = { from, to };
  }
  return list;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const pageId = process.env.FB_PAGE_ID;
  const rawToken = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!pageId || !rawToken) return res.status(503).json({ error: '尚未設定 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN。' });

  const denied = gate(req, process.env.FB_CAMPAIGN_ACCESS_CODE);
  if (denied) return res.status(denied.startsWith('尚未設定') ? 503 : 401).json({ error: denied });

  const body = req.method === 'POST' ? (req.body || {}) : {};
  const months = Math.min(Math.max(Number.parseInt(body.months ?? req.query?.months, 10) || 24, 1), 36);
  const aliases = mergeAliases(body.aliases);

  let token;
  try {
    ({ token } = await resolvePageToken(rawToken, pageId));
  } catch (error) {
    return res.status(502).json({ error: error?.message || '無法取得粉絲專頁權杖。' });
  }

  try {
    const { data, truncated } = await graphGetAll(
      `${pageId}/published_posts?fields=${POST_FIELDS}&limit=100&since=${sinceSeconds(months)}`,
      token,
      { timeoutMs: 45000 }
    );
    const posts = data.map(normalizePost).filter(Boolean);
    const baseline = buildBaseline(posts, { aliases });
    return res.status(200).json({ ok: true, months, truncated, baseline, categories: REWARD_CATEGORIES });
  } catch (error) {
    const msg = error?.name === 'TimeoutError' ? 'Facebook 回應超時，請重試。' : (error?.message || '查詢失敗，請重試。');
    return res.status(502).json({ error: msg });
  }
}
