// 從貼文文案抽出「活動獎勵」「活動時間」等欄位,用來做獎勵 ↔ 互動的對照表。
//
// 依據:2026-11-18 使用者說他粉專的活動貼文會列出結構化欄位
// 「活動方式 / 活動獎勵 / 活動時間」。這裡就是去抓那些欄位後面的內容。
//
// **尚未用真實文案逐則校準。** 抽不到就回空字串,寧可留白也不要瞎猜——
// 報表上看到空白,使用者就知道那則貼文的寫法沒被涵蓋,可以告訴我補規則。

// 欄位名後面可能接全/半角冒號、空白、換行,也可能直接接內容
const FIELD_SEPARATOR = '[:：]?\\s*';

function fieldValue(text, names, maxLen = 80) {
  for (const name of names) {
    const re = new RegExp(name + FIELD_SEPARATOR + '([^\\n]{1,' + maxLen + '})');
    const m = re.exec(text);
    if (m && m[1]) {
      // 砍掉下一個欄位名開頭的部分(例:「獎勵:A 活動時間:B」只要 A)
      const cut = m[1].split(/【|活動(方式|辦法|時間|資格|對象|規則)|參加方式|注意事項/)[0];
      const v = cut.trim().replace(/\s+/g, ' ');
      if (v) return v;
    }
  }
  return '';
}

export function extractReward(message) {
  const text = typeof message === 'string' ? message : '';
  if (!text.trim()) return '';
  return fieldValue(text, ['活動獎勵', '獎勵內容', '獎勵', '好禮', '贈品']);
}

export function extractPeriod(message) {
  const text = typeof message === 'string' ? message : '';
  if (!text.trim()) return '';
  const field = fieldValue(text, ['活動時間', '活動期間', '活動檔期', '時間'], 60);
  if (field) return field;
  // 沒有欄位名時,找像日期區間的字串(2026/11/20 - 11/30、11/20~11/30)
  const m = /(\d{1,4}[\/\-.]\d{1,2}([\/\-.]\d{1,2})?)\s*[~\-–至]\s*(\d{1,4}[\/\-.]\d{1,2}([\/\-.]\d{1,2})?)/.exec(text);
  return m ? m[0].replace(/\s+/g, ' ') : '';
}

export function extractMethod(message) {
  const text = typeof message === 'string' ? message : '';
  if (!text.trim()) return '';
  return fieldValue(text, ['活動方式', '活動辦法', '參加方式', '參與方式', '活動規則'], 70);
}

// 獎勵裡的數量線索(x3、3名、三位),規模大小會影響參與意願
export function extractQuantity(reward) {
  const text = typeof reward === 'string' ? reward : '';
  const m = /(?:[xX×]\s*(\d{1,4}))|(?:(\d{1,4})\s*(?:名|位|份|組|個))/.exec(text);
  if (!m) return null;
  const n = Number.parseInt(m[1] || m[2], 10);
  return Number.isFinite(n) ? n : null;
}

// 獎勵裡的金額線索(NT$500、500元)
export function extractValue(reward) {
  const text = typeof reward === 'string' ? reward : '';
  const m = /(?:NT\$|NT|\$)\s*([\d,]{2,9})|([\d,]{2,9})\s*元/i.exec(text);
  if (!m) return null;
  const n = Number.parseInt((m[1] || m[2] || '').replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

// 把一則貼文整理成報表的一列。
export function toRewardRow(post, classify) {
  const reward = extractReward(post.message);
  return {
    id: post.id || '',
    date: post.createdTime ? String(post.createdTime).slice(0, 10) : '',
    typeId: post.typeId || (classify ? classify(post.message).id : ''),
    reward,
    quantity: extractQuantity(reward),
    value: extractValue(reward),
    period: extractPeriod(post.message),
    method: extractMethod(post.message),
    comments: post.comments ?? 0,
    reactions: post.reactions ?? 0,
    shares: post.shares ?? 0,
    engagement: post.engagement ?? 0,
    reach: post.reach ?? null,
    permalink: post.permalink || '',
    excerpt: (post.message || '').replace(/\s+/g, ' ').slice(0, 50)
  };
}

const CSV_HEADERS = [
  '發布日期', '貼文類型', '活動獎勵', '獎勵數量', '獎勵金額', '活動檔期', '參加方式',
  '留言數', '心情數', '分享數', '互動總數', '觸及人數', '文案開頭', '貼文連結'
];

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function rewardCsv(rows = [], typeLabelFn = (x) => x) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      r.date, typeLabelFn(r.typeId), r.reward, r.quantity, r.value, r.period, r.method,
      r.comments, r.reactions, r.shares, r.engagement, r.reach, r.excerpt, r.permalink
    ].map(csvCell).join(','));
  }
  // 加 BOM,Excel 開啟才不會把 UTF-8 中文讀成亂碼
  return '\uFEFF' + lines.join('\r\n');
}
