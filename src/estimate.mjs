// 預估一則「還沒發的活動貼文」大概會有多少留言。
//
// 設計原則:**可解釋**。每個數字都要說得出「參考了哪幾則過去的活動、做了什麼調整」,
// 不要給一個沒來源的數字。使用者要拿這個去跟主管解釋。
//
// 流程:
//   1. 初判(detectDraft):從文案抽出獎勵品項與數量、參與方式、發放方式;日期算檔期長度。
//      **初判結果一定要讓使用者可以改**——文案寫法千變萬化,我判錯的時候她改一下就好。
//   2. 選對標群(pickComparables):同品項同參與方式 → 同品項 → 同魅力度級同方式 → 同方式 → 全部。
//      一層樣本不足就退下一層,並把退到哪一層講出來。
//   3. 時間校正:粉專基礎熱度一直在掉(非活動貼文留言中位數 2025H1=7、2026H1=2),
//      所以要把舊活動的留言數換算到「現在」的水準,否則一律高估。
//   4. 季節:月份係數算得出來,但 11 月的 3.74 倍主因是 7-11 禮券連發五天,
//      那是單一活動效應不是季節效應。**預設不套用**,只顯示給使用者參考。
import baseline from './campaign-baseline.mjs';
import {
  extractRewardLines, parseRewardLine, cleanRewardName,
  classifyDifficulty, classifyDelivery, isCampaignPost, DIFFICULTY
} from './activity-extract.mjs';

export const BASELINE = baseline;

const med = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  if (!s.length) return 0;
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const quant = (a, q) => {
  const s = a.slice().sort((x, y) => x - y);
  if (!s.length) return 0;
  if (s.length === 1) return s[0];
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos); const hi = Math.ceil(pos);
  return lo === hi ? s[lo] : Math.round(s[lo] + (s[hi] - s[lo]) * (pos - lo));
};
const half = (d) => String(d).slice(0, 4) + (Number(String(d).slice(5, 7)) <= 6 ? 'H1' : 'H2');

export function periodFactor(fromDate, toDate) {
  const a = baseline.periodBaseline[half(fromDate)]?.median;
  const b = baseline.periodBaseline[half(toDate)]?.median;
  if (!a || !b) return 1;
  return b / a;
}

// 最新一期的基準,當作「現在」的水準
export function latestPeriod() {
  return Object.keys(baseline.periodBaseline).sort().slice(-1)[0];
}

export function durationDays(start, end) {
  if (!start || !end) return null;
  const a = new Date(start); const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const d = Math.round((b - a) / 86400000) + 1;
  return d > 0 ? d : null;
}

// --- 品項正規化:把文案抽到的名稱對應到基準表裡的品項 ---
const norm = (s) => String(s ?? '').replace(/\s/g, '').replace(/級/g, '')
  .replace(/[×xX＊*]/g, '*').replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30));

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

// 回傳基準表裡最符合的品項;找不到回 null(UI 會請使用者自己選)
export function matchItem(name, qty) {
  const want = norm(name);
  if (!want) return null;
  const candidates = baseline.items.filter((i) => {
    const k = norm(i.item);
    return k && (want.includes(k) || k.includes(want));
  });
  if (!candidates.length) return null;
  // 同數量優先,再取樣本多的
  const sameQty = candidates.filter((i) => String(i.qty) === String(qty));
  const pool = sameQty.length ? sameQty : candidates;
  return pool.slice().sort((a, b) => b.posts - a.posts)[0];
}

export function itemKey(item) {
  return item ? item.item + '｜' + item.qty : '';
}

// --- 初判 ---
export function detectDraft(message, { start = '', end = '' } = {}) {
  const text = String(message ?? '');
  const lines = extractRewardLines(text);
  const parsed = lines.map((l) => parseRewardLine(l, text, (text.split('\n')[0] || '').trim()));

  const rewards = [];
  for (const p of parsed) {
    for (const piece of splitRewardPieces(p.name)) {
      const { name, qty } = parseQty(piece);
      if (!name || name.length < 2) continue;
      const matched = matchItem(name, qty);
      rewards.push({
        raw: piece, name, qty,
        matchedItem: matched ? matched.item : '',
        matchedQty: matched ? String(matched.qty) : '',
        grade: matched ? matched.grade : '',
        score: matched ? matched.score : null,
        posts: matched ? matched.posts : 0
      });
    }
  }

  const deliveries = [...new Set(parsed.map((p) => p.delivery).filter((d) => d && d !== '未標示'))];
  return {
    isCampaign: isCampaignPost(text),
    rewardLines: lines,
    rewards,
    difficulty: classifyDifficulty(text),
    delivery: deliveries.length === 0 ? '未標示' : deliveries.length === 1 ? deliveries[0] : '兩種都有',
    start, end,
    duration: durationDays(start, end)
  };
}

// --- 選對標群 ---
export const MIN_SAMPLE = 3;

export function pickComparables(detected, { itemKeys = null } = {}) {
  const driven = baseline.activities.filter((a) => a.type === '留言互動型');
  const keys = itemKeys
    ?? detected.rewards.map((r) => (r.matchedItem ? r.matchedItem + '｜' + r.matchedQty : '')).filter(Boolean);
  const wantNames = keys.map((k) => norm(k.split('｜')[0])).filter(Boolean);

  const sameItem = wantNames.length
    ? driven.filter((a) => wantNames.some((w) => norm(a.rewards).includes(w)))
    : [];
  const sameItemAndWay = sameItem.filter((a) => a.difficulty === detected.difficulty);
  if (sameItemAndWay.length >= MIN_SAMPLE) {
    return { group: sameItemAndWay, tier: 'item+way',
      basis: `過去用過同樣獎勵、而且參與方式也是「${detected.difficulty}」的 ${sameItemAndWay.length} 則活動` };
  }
  if (sameItem.length >= 2) {
    return { group: sameItem, tier: 'item',
      basis: `過去用過同樣獎勵的 ${sameItem.length} 則活動(參與方式不限,因為同方式的樣本不足 ${MIN_SAMPLE} 則)` };
  }

  // 退到同魅力度分級
  const grades = [...new Set(detected.rewards.map((r) => r.grade).filter((g) => g && g !== '樣本不足'))];
  if (grades.length) {
    const gradeItems = baseline.items.filter((i) => grades.includes(i.grade)).map((i) => norm(i.item));
    const sameGrade = driven.filter((a) => gradeItems.some((g) => g && norm(a.rewards).includes(g)));
    const sameGradeAndWay = sameGrade.filter((a) => a.difficulty === detected.difficulty);
    if (sameGradeAndWay.length >= MIN_SAMPLE) {
      return { group: sameGradeAndWay, tier: 'grade+way',
        basis: `魅力度同為 ${grades.join('/')} 級的獎勵、參與方式也相同的 ${sameGradeAndWay.length} 則活動(這個獎勵本身辦得太少)` };
    }
    if (sameGrade.length >= MIN_SAMPLE) {
      return { group: sameGrade, tier: 'grade',
        basis: `魅力度同為 ${grades.join('/')} 級的 ${sameGrade.length} 則活動` };
    }
  }

  const sameWay = driven.filter((a) => a.difficulty === detected.difficulty);
  if (sameWay.length >= MIN_SAMPLE) {
    return { group: sameWay, tier: 'way',
      basis: `參與方式同為「${detected.difficulty}」的 ${sameWay.length} 則活動(這個獎勵沒有可比的歷史)` };
  }
  return { group: driven, tier: 'all',
    basis: `全部 ${driven.length} 則留言互動型活動(同獎勵與同參與方式都沒有足夠樣本)` };
}

// --- 主函式 ---
export function estimate(detected, { publishDate = '', useSeasonFactor = false, itemKeys = null } = {}) {
  const target = publishDate || detected.start || '';
  const toPeriod = target ? half(target) : latestPeriod();
  const { group, tier, basis } = pickComparables(detected, { itemKeys });

  if (!group.length) {
    return { ok: false, reason: '基準表裡沒有可比的活動,無法預估。' };
  }

  // 時間校正:把每則的留言數換算到預計發布的那一期
  const adjusted = group.map((a) => {
    const f = periodFactor(a.date, target || `${toPeriod.slice(0, 4)}-${toPeriod.endsWith('H1') ? '03' : '09'}-01`);
    return { ...a, factor: Math.round(f * 100) / 100, adjustedComments: Math.max(0, Math.round(a.comments * f)) };
  });

  const values = adjusted.map((a) => a.adjustedComments);
  let expected = med(values);
  let low = quant(values, 0.25);
  let high = quant(values, 0.75);

  const explain = [
    `對標群:${basis}。`,
    `時間校正:粉專基礎熱度一直在變(非活動貼文的留言中位數 ${Object.entries(baseline.periodBaseline).sort().map(([k, v]) => k + '=' + v.median).join('、')}),` +
      `所以把每則對標活動的留言數換算到 ${toPeriod} 的水準再取中位數。`
  ];
  const warnings = [];

  // --- 參與方式校正 ---
  // 對標群沒有按參與方式篩過時(退層了),群裡多半是別種門檻的活動。
  // 「只要留言」中位數 166、「要附截圖」只有 90——門檻差一道就掉快一半,
  // 不校正的話使用者改了「參與方式」卻看到同一個數字(2026-11-20 實測發現)。
  const targetWay = baseline.difficulty.find((d) => d.label === detected.difficulty);
  let wayFactor = 1;
  if (!tier.includes('way') && targetWay && targetWay.n >= MIN_SAMPLE) {
    const groupWayMedians = group.map((a) => {
      const w = baseline.difficulty.find((d) => d.label === a.difficulty);
      return w && w.n >= MIN_SAMPLE ? w.median : baseline.overallMedian;
    });
    const groupWayMedian = med(groupWayMedians);
    if (groupWayMedian > 0) {
      wayFactor = Math.round((targetWay.median / groupWayMedian) * 100) / 100;
      if (wayFactor !== 1) {
        expected = Math.round(expected * wayFactor);
        low = Math.round(low * wayFactor);
        high = Math.round(high * wayFactor);
        explain.push(
          `參與方式校正:對標的活動多半是別種門檻,把它們換算成「${detected.difficulty}」的水準(×${wayFactor})。` +
          `依據是各參與方式的留言中位數——${baseline.difficulty.filter((d) => d.n >= MIN_SAMPLE).map((d) => `${d.label} ${d.median}(${d.n} 則)`).join('、')}。`
        );
      }
    }
  } else if (targetWay && targetWay.n < MIN_SAMPLE) {
    warnings.push(`「${detected.difficulty}」在歷史上只有 ${targetWay.n} 則,沒辦法用它校正,預估沒有把這個門檻的影響算進去。`);
  }

  const month = Number(String(target).slice(5, 7));
  const seasonInfo = baseline.monthly.find((m) => m.month === month) || null;
  if (useSeasonFactor && seasonInfo?.factor) {
    expected = Math.round(expected * seasonInfo.factor);
    low = Math.round(low * seasonInfo.factor);
    high = Math.round(high * seasonInfo.factor);
    explain.push(`季節調整:${month} 月的歷史活動留言中位數是整體的 ${seasonInfo.factor} 倍(${seasonInfo.n} 則),已套用。`);
  } else if (seasonInfo?.factor) {
    explain.push(`${month} 月的歷史活動留言中位數是整體的 ${seasonInfo.factor} 倍(${seasonInfo.n} 則),但**預設沒有套用**——樣本太少時這個倍數常常是某一檔活動造成的,不是季節本身。要套用請打開季節調整。`);
  } else if (month) {
    explain.push(`${month} 月的歷史活動樣本不足 3 則,沒有季節係數可用。`);
  }

  if (group.length < MIN_SAMPLE) warnings.push(`對標只有 ${group.length} 則,樣本太少,這個數字只能當粗略參考。`);
  if (tier === 'all' || tier === 'way') warnings.push('沒有用過同樣獎勵的歷史活動,預估是靠參與方式推的,誤差會比較大。');
  if (detected.rewards.some((r) => !r.matchedItem)) warnings.push('有獎勵對不到基準表裡的品項,建議在上面手動指定,預估才會準。');
  if (detected.delivery === '未標示') warnings.push('文案裡看不出是留言就送還是留言就抽,建議手動指定。');

  return {
    ok: true,
    expected, low, high,
    sampleSize: group.length,
    tier, basis,
    wayFactor,
    period: toPeriod,
    confidence: group.length >= 8 ? 'high' : group.length >= MIN_SAMPLE ? 'medium' : 'low',
    season: seasonInfo,
    seasonApplied: Boolean(useSeasonFactor && seasonInfo?.factor),
    explain,
    warnings,
    comparables: adjusted
      .slice()
      .sort((a, b) => b.adjustedComments - a.adjustedComments)
      .map((a) => ({
        date: a.date, title: a.title, rewards: a.rewards, difficulty: a.difficulty,
        delivery: a.delivery, comments: a.comments,
        adjustedComments: a.adjustedComments, factor: a.factor, permalink: a.permalink
      })),
    caveat: '這是留言數的預估,不是活動參與人數(Facebook API 不提供參與人數)。文案寫法、廣告投放、改版時程都會影響結果。'
  };
}

export const DIFFICULTY_LIST = Object.values(DIFFICULTY);
export const DELIVERY_LIST = ['留言就送', '留言就抽', '兩種都有', '未標示'];
