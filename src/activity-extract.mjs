// 從活動貼文抽出「標題 + 獎勵內容 + 留言數」。
//
// 規格來自 2026-11-19 使用者的明確指示:
//   「你只要看我貼文文案中有『活動獎勵』這四個字,然後撈出那篇貼文的
//     第一行、獎勵內容、和留言數。」
//
// 他給的實例:
//   【中秋送好禮🌕】維拉．塔莉卡陪你一起過中秋💕      ← 第一行(標題)
//   參與活動即可獲得活動解碼器 ×3（每帳號限領 1 次）   ← 獎勵內容第 1 行(留言就送)
//   參與玩家中抽出 維拉．塔莉卡 x1  共1名              ← 獎勵內容第 2 行(留言就抽)
//   留言數 165
//
// **關鍵:獎勵內容是多行的**(同一個活動常常同時有「即可獲得」和「抽出」兩種發放方式),
// 所以不能只抓一行。上一版只抓單行 80 字,使用者回報「抓得不夠好」就是這個原因。
//
// 這一輪只負責「抓出來」。獎勵魅力度、發放方式與留言數的關聯是下一步,刻意不做。

export const REWARD_FIELD = '活動獎勵';

// 獎勵區塊到哪裡結束:遇到下一個結構化欄位名就停
const STOP_PATTERNS = [
  /^【/,                                    // 下一個區塊標題
  /活動(方式|辦法|時間|期間|檔期|資格|對象|規則|說明|連結|網址)/,
  /(參加|參與)方式/,
  /注意事項/,
  /得獎(公布|名單|通知)/,
  /^#/                                      // hashtag 區
];

function isStopLine(line) {
  const t = line.trim();
  if (!t) return false;
  return STOP_PATTERNS.some((re) => re.test(t));
}

// 貼文是不是我們要的活動貼文:文案裡有「活動獎勵」四個字
export function hasRewardField(message) {
  return typeof message === 'string' && message.includes(REWARD_FIELD);
}

// 第一行當標題。前面可能有空行,跳過;長度留到 120 字(標題常有 emoji 與副標)
export function extractTitle(message, maxLen = 120) {
  const text = typeof message === 'string' ? message : '';
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t) return t.slice(0, maxLen);
  }
  return '';
}

// 「活動獎勵」之後的整段內容(多行),到下一個欄位名為止。
// 回傳陣列,一個元素一行——這樣使用者就看得出「有幾種獎勵發放方式」。
export function extractRewardLines(message, maxLines = 8) {
  const text = typeof message === 'string' ? message : '';
  const idx = text.indexOf(REWARD_FIELD);
  if (idx < 0) return [];

  // 從「活動獎勵」那一行開始切。同一行冒號後面若有內容,那也算第一行獎勵。
  const after = text.slice(idx + REWARD_FIELD.length);
  const lines = after.split('\n');
  const out = [];

  // 第一行:去掉開頭的冒號、空白、裝飾符號
  const firstInline = lines[0].replace(/^[\s:：\-—、。]+/, '').trim();
  if (firstInline && !isStopLine(firstInline)) out.push(firstInline);

  for (let i = 1; i < lines.length && out.length < maxLines; i++) {
    const t = lines[i].trim();
    if (!t) {
      // 空行:已經收到內容就結束,還沒收到就繼續找(欄位名與內容之間可能空一行)
      if (out.length) break;
      continue;
    }
    if (isStopLine(t)) break;
    out.push(t);
  }
  return out;
}

export function extractRewardText(message) {
  return extractRewardLines(message).join('\n');
}

// 整理成報表的一列。只放使用者這次要的欄位,不多塞。
export function toActivityRow(post) {
  const rewardLines = extractRewardLines(post.message);
  return {
    id: post.id || '',
    date: post.createdTime ? String(post.createdTime).slice(0, 10) : '',
    title: extractTitle(post.message),
    rewardLines,
    rewardCount: rewardLines.length,
    comments: post.comments ?? 0,
    reactions: post.reactions ?? 0,
    shares: post.shares ?? 0,
    permalink: post.permalink || ''
  };
}

const CSV_HEADERS = ['發布日期', '活動標題', '獎勵內容', '獎勵項目數', '留言數', '心情數', '分享數', '貼文連結'];

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function activityCsv(rows = []) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      r.date, r.title, r.rewardLines.join('\n'), r.rewardCount,
      r.comments, r.reactions, r.shares, r.permalink
    ].map(csvCell).join(','));
  }
  // BOM:Excel 開啟才不會把 UTF-8 中文讀成亂碼
  return '\uFEFF' + lines.join('\r\n');
}
