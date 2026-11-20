// 從「粉專貼文」算出預估用的基準表。
// 前端(一鍵更新)與產生腳本共用同一份邏輯,免得兩邊算法漂移。
import { toActivityRow, isCampaignPost } from './activity-extract.mjs';
import { normalizeItemName, needsCategory, BUILTIN_ALIASES } from './reward-aliases.mjs';

export const med = (a) => {
  const s = a.filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
export const quant = (a, q) => {
  const s = a.filter((x) => Number.isFinite(x)).slice().sort((x, y) => x - y);
  if (!s.length) return 0;
  if (s.length === 1) return s[0];
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : Math.round(s[lo] + (s[hi] - s[lo]) * (pos - lo));
};
export const half = (d) => String(d).slice(0, 4) + (Number(String(d).slice(5, 7)) <= 6 ? 'H1' : 'H2');

export function splitRewardPieces(name) {
  return String(name).split(/[＋+、，,]|\s+\+\s+/).map((s) => s.trim()).filter(Boolean);
}
export function parseQty(piece) {
  let m = /^(.*?)[\s]*[×xX*＊]\s*(\d+)\s*$/.exec(piece);
  if (m) return { name: m[1].trim(), qty: m[2] };
  m = /^(.*?)[\s]*(\d+)\s*(個|份|張|組|套|日|天|點)\s*$/.exec(piece);
  if (m) return { name: m[1].trim(), qty: m[2] };
  return { name: piece.trim(), qty: '' };
}

const normKey = (s) => String(s ?? '').replace(/\s/g, '').replace(/級/g, '')
  .replace(/[×xX＊*]/g, '*').replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30));

// posts: normalizePost 之後的貼文(要有 message / createdTime / comments…)
// aliases: 品類對照(內建 + 營運在面板上補的)
export function buildBaseline(posts = [], { aliases = BUILTIN_ALIASES, generatedAt = '' } = {}) {
  const scanned = posts.length;

  // 粉專基礎熱度:非活動貼文的留言中位數,用來校正時間漂移
  const baseGroups = {};
  for (const p of posts) {
    const date = p.createdTime ? String(p.createdTime).slice(0, 10) : '';
    if (!date || isCampaignPost(p.message)) continue;
    (baseGroups[half(date)] ||= []).push(p.comments ?? 0);
  }
  const periodBaseline = {};
  for (const [k, v] of Object.entries(baseGroups)) periodBaseline[k] = { median: Math.max(1, med(v)), n: v.length };

  // 活動貼文
  const rows = posts.filter((p) => isCampaignPost(p.message)).map(toActivityRow)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const activities = rows.map((r) => ({
    date: r.date,
    type: r.commentDriven ? '留言互動型' : '非留言型',
    difficulty: r.difficulty || '',
    title: r.title,
    rewards: r.rewards.map((x) => x.name).join('\n'),
    delivery: r.delivery,
    comments: r.comments, reactions: r.reactions, shares: r.shares,
    permalink: r.permalink
  }));
  const driven = activities.filter((a) => a.type === '留言互動型');
  const overallMedian = med(driven.map((a) => a.comments));

  const groupBy = (arr, fn) => {
    const g = {};
    for (const a of arr) (g[fn(a) || '（未填）'] ||= []).push(a.comments);
    return Object.entries(g).map(([label, v]) => ({
      label, n: v.length, median: med(v), p25: quant(v, 0.25), p75: quant(v, 0.75)
    })).sort((a, b) => b.n - a.n);
  };

  const monthGroups = {};
  for (const a of driven) {
    const m = Number(String(a.date).slice(5, 7));
    if (m) (monthGroups[m] ||= []).push(a.comments);
  }
  const monthly = [];
  for (let m = 1; m <= 12; m++) {
    const v = monthGroups[m] || [];
    monthly.push({
      month: m, n: v.length, median: v.length ? med(v) : null,
      factor: v.length >= 3 && overallMedian > 0 ? Math.round((med(v) / overallMedian) * 100) / 100 : null
    });
  }

  // 獎勵品項:拆項、套品類對照、同一則活動內同品項只算一筆
  const bucket = new Map();
  const pending = new Map();
  for (const r of rows) {
    for (const rw of r.rewards) {
      for (const piece of splitRewardPieces(rw.name)) {
        const { name, qty } = parseQty(piece);
        if (!name || name.length < 2) continue;
        if (needsCategory(name, aliases)) {
          if (!pending.has(name)) pending.set(name, { name, dates: [], raw: piece });
          pending.get(name).dates.push(r.date);
        }
        const item = normalizeItemName(name, aliases);
        const key = item + '｜' + qty;
        if (!bucket.has(key)) bucket.set(key, { item, qty, seen: new Set(), pts: [], dates: [], modes: new Set() });
        const e = bucket.get(key);
        const dedupe = r.date + '|' + r.comments;
        e.modes.add(rw.delivery);
        if (e.seen.has(dedupe)) continue;    // 同一則列了兩次 → 一筆
        e.seen.add(dedupe);
        e.pts.push(r.comments);
        e.dates.push(r.date);
      }
    }
  }

  const items = [...bucket.values()].map((e) => {
    const ratios = e.pts.map((c, i) => c / (periodBaseline[half(e.dates[i])]?.median || 3));
    return {
      item: e.item, qty: e.qty,
      posts: e.pts.length,
      median: med(e.pts), p25: quant(e.pts, 0.25), p75: quant(e.pts, 0.75),
      min: Math.min(...e.pts), max: Math.max(...e.pts),
      score: Math.round(med(ratios) * 10) / 10,
      modes: [...e.modes].filter((m) => m && m !== '未標示'),
      dates: e.dates.slice().sort(),
      samples: e.pts.slice().sort((a, b) => a - b)
    };
  }).sort((a, b) => b.score - a.score);

  const scored = items.filter((i) => i.posts >= 3).map((i) => i.score).sort((a, b) => a - b);
  const p66 = scored[Math.floor(scored.length * 0.66)] ?? 0;
  const p33 = scored[Math.floor(scored.length * 0.33)] ?? 0;
  for (const i of items) {
    i.grade = i.posts < 3 ? '樣本不足' : i.score >= p66 ? 'A' : i.score >= p33 ? 'B' : 'C';
  }

  return {
    generatedAt: generatedAt || new Date().toISOString().slice(0, 10),
    source: `Facebook Graph API published_posts，掃過 ${scanned} 則貼文；獎勵品類對照 ${aliases.length} 筆`,
    caveats: [
      '留言數不等於活動參與人數。Facebook API 不提供參與人數，那在遊戲後台。',
      '魅力度分數 = 該則留言 ÷ 同半年非活動貼文的留言中位數，衡量「比平常熱多少倍」，不是遊戲內價值。',
      '沒有控制文案品質、廣告投放、改版時程等變數。'
    ],
    scanned,
    overallMedian,
    periodBaseline,
    monthly,
    difficulty: groupBy(driven, (a) => a.difficulty),
    delivery: groupBy(driven, (a) => a.delivery),
    items,
    activities,
    // 需要營運指定品類的新道具
    unclassified: [...pending.values()]
      .map((p) => ({ name: p.name, count: p.dates.length, dates: p.dates.slice().sort() }))
      .sort((a, b) => b.count - a.count)
  };
}

export { normKey };
