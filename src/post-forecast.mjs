// 用粉專過去貼文的實際成效,預估「即將發布的這則」大概會有多少互動。
//
// 刻意做成可解釋的統計,不是黑箱:
//   1. 找出歷史貼文裡「跟這則最像」的一群(先比對有無圖片,再比對文案長度)
//   2. 取那群的中位數當預期值,用第 25~75 百分位當區間
//   3. 樣本不足就往上退一層(同圖片類型 → 全部貼文),並把退到哪一層講出來
//
// 為什麼用中位數不用平均:粉專貼文的互動分布很偏——一則爆文就會把平均拉高,
// 預估值變得沒有參考價值。中位數對離群值穩定。
//
// 口徑說明:這裡的 engagement = 心情數 + 留言數 + 分享數,
// 是不需要 read_insights 權限就拿得到的數字。
// **它跟 Facebook 後台的「互動人數」不同**(後台算的是不重複人數),不要混著比。
import { classifyPost, typeLabel, typeBreakdown, hasDiscriminativePower } from './post-types.mjs';

export const MIN_SAMPLE = 3;          // 一群少於這麼多則就不可信,往上退一層
export const CONFIDENT_SAMPLE = 12;   // 達到這個量才算有把握

export function median(values) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : Math.round((nums[mid - 1] + nums[mid]) / 2);
}

export function quantile(values, q) {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!nums.length) return null;
  if (nums.length === 1) return nums[0];
  const pos = (nums.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return nums[lo];
  return Math.round(nums[lo] + (nums[hi] - nums[lo]) * (pos - lo));
}

export function countHashtags(text) {
  if (typeof text !== 'string') return 0;
  return (text.match(/#[^\s#]+/g) || []).length;
}

export function lengthBucket(charCount) {
  if (charCount < 100) return '短';
  if (charCount <= 300) return '中';
  return '長';
}

// 從一則貼文(或草稿)抽出用來比對的特徵。
export function extractFeatures(input = {}) {
  const message = typeof input.message === 'string' ? input.message : '';
  const charCount = message.trim().length;
  const feature = {
    hasImage: Boolean(input.hasImage),
    charCount,
    lengthBucket: lengthBucket(charCount),
    hashtags: countHashtags(message),
    hour: null,
    weekday: null
  };
  if (input.createdTime) {
    const d = new Date(input.createdTime);
    if (!Number.isNaN(d.getTime())) {
      feature.hour = d.getHours();
      feature.weekday = d.getDay();
    }
  }
  return feature;
}

// 歷史貼文的整體樣貌,給面板顯示用。
export function summarizeHistory(posts = []) {
  const usable = posts.filter((p) => p && Number.isFinite(p.engagement));
  if (!usable.length) {
    return { count: 0, medianEngagement: null, medianReactions: null, withImage: 0, withoutImage: 0, best: null };
  }
  const best = usable.reduce((a, b) => (b.engagement > a.engagement ? b : a));
  const withType = usable.map((p) => ({ ...p, typeId: p.typeId || classifyPost(p.message).id }));
  return {
    count: usable.length,
    medianEngagement: median(usable.map((p) => p.engagement)),
    medianReactions: median(usable.map((p) => p.reactions)),
    p25: quantile(usable.map((p) => p.engagement), 0.25),
    p75: quantile(usable.map((p) => p.engagement), 0.75),
    withImage: usable.filter((p) => p.hasImage).length,
    withoutImage: usable.filter((p) => !p.hasImage).length,
    breakdown: typeBreakdown(withType, median),
    best: { id: best.id, engagement: best.engagement, permalink: best.permalink, message: (best.message || '').slice(0, 60) }
  };
}

function confidenceOf(sampleSize) {
  if (sampleSize >= CONFIDENT_SAMPLE) return 'high';
  if (sampleSize >= MIN_SAMPLE) return 'medium';
  return 'low';
}

// 主要功能:給定歷史貼文與這次的草稿,回傳預估值與「憑什麼這樣估」。
//
// 2026-11-18 改版:分群依據從「有圖/沒圖 + 文案長度」改成 **貼文類型**。
// 原因是使用者回報預估不準,而且指出了真正的原因:留言抽獎文和影片轉發文的留言數
// 差距極大,混在一起取中位數,兩邊都失真。貼文類型才是決定互動量的主要因素,
// 有沒有圖只是次要。
export function forecastEngagement(posts = [], draft = {}) {
  const usable = posts.filter((p) => p && Number.isFinite(p.engagement));
  if (!usable.length) {
    return {
      ok: false,
      reason: '沒有可用的歷史貼文成效,無法預估。先讀取粉專過去的貼文。',
      historyCount: 0
    };
  }

  const want = extractFeatures(draft);
  // 草稿的類型:使用者可以手動指定(draft.typeId),否則自動判斷
  const autoType = classifyPost(draft.message);
  const typeId = draft.typeId || autoType.id;

  const withType = usable.map((p) => ({ ...p, typeId: p.typeId || classifyPost(p.message).id }));
  const sameType = withType.filter((p) => p.typeId === typeId);
  const sameTypeAndImage = sameType.filter((p) => Boolean(p.hasImage) === want.hasImage);

  const breakdown = typeBreakdown(withType, median);
  const discriminative = hasDiscriminativePower(breakdown);

  let group = sameTypeAndImage;
  let tier = 'type+image';
  let basis = `「${typeLabel(typeId)}」且${want.hasImage ? '有圖' : '純文字'}的 ${group.length} 則貼文`;

  if (group.length < MIN_SAMPLE) {
    group = sameType;
    tier = 'type';
    basis = `「${typeLabel(typeId)}」的 ${group.length} 則貼文(不分有圖與否,同類型樣本太少)`;
  }
  if (group.length < MIN_SAMPLE) {
    group = withType;
    tier = 'all';
    basis = `全部 ${group.length} 則貼文(同類型只有 ${sameType.length} 則,不足以單獨估算)`;
  }

  const engagements = group.map((p) => p.engagement);
  return {
    ok: true,
    expected: median(engagements),
    low: quantile(engagements, 0.25),
    high: quantile(engagements, 0.75),
    expectedReactions: median(group.map((p) => p.reactions)),
    expectedComments: median(group.map((p) => p.comments)),
    expectedShares: median(group.map((p) => p.shares)),
    sampleSize: group.length,
    historyCount: usable.length,
    tier,
    basis,
    confidence: confidenceOf(group.length),
    features: want,
    typeId,
    typeLabel: typeLabel(typeId),
    typeAuto: autoType,
    typeIsManual: Boolean(draft.typeId) && draft.typeId !== autoType.id,
    breakdown,
    discriminative,
    // 同類型裡最高與最低,讓使用者判斷這個預估合不合理
    samples: group
      .slice()
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 3)
      .map((p) => ({ engagement: p.engagement, comments: p.comments, message: (p.message || '').slice(0, 40), permalink: p.permalink })),
    caveat: '預估值是同類型歷史貼文的中位數,不是保證。觸及會受發布時間、廣告投放與演算法影響。'
  };
}
