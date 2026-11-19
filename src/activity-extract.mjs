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
  // 「✨獎勵發放時間:9/17 維護後」是時程不是獎勵,要停(2026-11-19 截圖第一列)
  /獎勵(?:發放|領取|寄送)?(?:時間|方式|日期)/,
  /發放(?:時間|日期)/,
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

// --- 2026-11-19 使用者要求:獎勵只留名稱,另外拉一欄「發放方式」 ---
//
// 他給的對照:
//   「參與活動即可獲得活動解碼器 ×3（每帳號限領 1 次）」→ 名稱「活動解碼器 ×3」、方式「留言就送」
//   「參與玩家中抽出 維拉．塔莉卡 x1  共1名」            → 名稱「維拉．塔莉卡 x1」、方式「留言就抽」
//
// 發放方式沿用他原本成效面板的 REWARD_MODES 概念(抽獎 / 符合條件即送),
// 但用他這次講的說法「留言就抽 / 留言就送」。

export const DELIVERY = {
  DRAW: '留言就抽',
  GIVE: '留言就送',
  UNKNOWN: '未標示'
};

// 2026-11-19 使用者回報「一堆未標示」,三個真實案例全部漏判,原因有三個:
//
// 1. **最直白的詞沒列。** 他文案直接寫「留言就抽」,我卻只列了「抽出/抽獎/抽選」,
//    偏偏漏掉「留言抽」「留言送」這種最常見的寫法。
// 2. **斜線格式沒處理。**「厄之章服裝選擇箱 ×1／留言就抽」用全角斜線把獎勵與方式分開。
// 3. **只看獎勵那幾行。**「【留言送解碼器】」寫在標題裡,獎勵行只有獎勵名稱,
//    所以在獎勵行裡永遠找不到線索 → 必須退回整篇文案再找一次。
//
// 判斷放在清理之前做,因為判斷的線索(「抽出」「即可獲得」)正是要被清掉的那些動詞。
const DRAW_PATTERNS = [
  /留言[^\n]{0,4}抽/,        // 留言就抽、留言抽、留言+抽、留言即抽
  /抽出/, /抽獎/, /抽選/, /抽中/, /抽\s*\d/, /中獎/, /幸運/,
  /[／\/]\s*抽/,              // 「獎勵／抽」
  /抽\s*[\d一二三四五六七八九十]+\s*(?:名|位|份|組)/
];
const GIVE_PATTERNS = [
  /留言[^\n]{0,4}(?:送|贈|得|領|拿)/,   // 留言就送、留言送、留言即贈、留言可領
  /即可獲得/, /即可領取/, /皆可獲得/, /都可獲得/, /人人/,
  /直接(?:送|贈|給)/, /即(?:送|贈)/, /免費(?:送|贈|領)/, /限領/,
  /[／\/]\s*(?:送|贈)/,       // 「獎勵／送」
  /全員/, /無條件/
];

// 2026-11-19 使用者第二次回報(截圖標了四處):
// 「寫共幾名的不是很明顯就是用抽的嗎?你為甚麼不自己判斷一下」
//
// 他標的真實案例:
//   「輪迴脈衝*1、全新男角巴德羅*1,共兩名」            ← 只有名額,沒有任何「抽」字
//   「輪迴脈衝*1、全新女角*1(5/14販售),共兩名」
//   「拳皇鬥士－伊莎貝拉 (永久)＋碧藍羽翼 (永久)＊１名」  ← 全角數字「１名」
//
// 推論很直接:**獎勵有名額上限 = 不是人人有獎 = 用抽的**。
// 另外標題寫「梗圖創作抽好禮」「抽出新角色」也是明示,但不符合既有的
// 「抽出/抽獎/留言抽」任何一條(「作抽好禮」中間卡了字),所以標題要用寬鬆的「抽」去認。

// 全角數字與中文數字正規化,否則「＊１名」「共兩名」都比不到
const FULLWIDTH_DIGITS = /[０-９]/g;
const CN_NUM = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

export function normalizeNumbers(text) {
  let t = String(text ?? '').replace(FULLWIDTH_DIGITS, (d) =>
    String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30)
  );
  // 只轉「數字 + 名/位/份」的中文數字,避免動到獎勵名稱裡的字(例:「三星武器」)
  t = t.replace(/[一二兩三四五六七八九十]+(?=\s*(?:名|位|份))/g, (m) => {
    if (m.length === 1) return String(CN_NUM[m] ?? m);
    if (m === '十') return '10';
    // 十幾 / 幾十
    if (m.startsWith('十')) return String(10 + (CN_NUM[m[1]] ?? 0));
    if (m.endsWith('十')) return String((CN_NUM[m[0]] ?? 0) * 10);
    return m;
  });
  return t;
}

// 名額型:有「共N名」「N名」「N位」就是有中獎上限 → 用抽的
const QUOTA_PATTERNS = [
  /(?:共|計|抽出|選出)?\s*\d+\s*(?:名|位)/
];
// 但「前 100 名」「限量」「額滿為止」是先到先得,不是抽
const FIRST_COME = /前\s*\d+\s*(?:名|位)|限量|先到先得|先搶先贏|額滿為止|送完為止/;

// 寬鬆的「抽」:只用在標題與整篇文案的 fallback。
// 排除遊戲裡本來就有的抽卡詞,否則「史詩解碼器」那種抽卡道具會被誤判成抽獎活動。
const LOOSE_DRAW = /抽/;
const NOT_LOTTERY = /抽卡|轉蛋|抽獎券|抽空|抽屜|抽成/;

export function classifyDelivery(line) {
  const t = normalizeNumbers(line);
  if (!t.trim()) return DELIVERY.UNKNOWN;
  // 1) 明示「抽」優先:「抽出 X 共1名」有時也寫「每人限領」,但抽才是關鍵動作
  if (DRAW_PATTERNS.some((re) => re.test(t))) return DELIVERY.DRAW;
  // 2) 明示「送」
  if (GIVE_PATTERNS.some((re) => re.test(t))) return DELIVERY.GIVE;
  // 3) 都沒明示,但有中獎名額 → 抽(先到先得的寫法除外)
  if (!FIRST_COME.test(t) && QUOTA_PATTERNS.some((re) => re.test(t))) return DELIVERY.DRAW;
  return DELIVERY.UNKNOWN;
}

// 標題/整篇文案用的寬鬆版:嚴格規則跑完還是不知道時,只要出現「抽」就當抽
export function classifyDeliveryLoose(text) {
  const strict = classifyDelivery(text);
  if (strict !== DELIVERY.UNKNOWN) return strict;
  const t = normalizeNumbers(text);
  if (LOOSE_DRAW.test(t) && !NOT_LOTTERY.test(t)) return DELIVERY.DRAW;
  return DELIVERY.UNKNOWN;
}

// 把一行獎勵描述清成只剩「名稱 + 數量」。
// 清不乾淨時回原字串,不要回空值——留白會讓使用者以為沒有獎勵。
//
// 兩個關鍵判斷(2026-11-19 實測後修正):
// 1. 一行裡若有「獲得/領取」,取**最後一個**之後的內容。
//    因為「抽出 10 名幸運玩家獲得 限定武器 x1」的前綴比想像的長,
//    用固定長度的前綴比對清不掉,反而留下「10 名幸運玩家獲得」。
// 2. **括號不可一律清掉。**「（7天）」「（永久）」是獎勵的重要屬性
//    (體驗型與永久型的魅力度差很多),只有「（每帳號限領 1 次）」這種名額附註才該清。
const GET_VERB = /(?:獲得|領取|拿到|得到)\s*/g;
const LEAD_PATTERNS = [
  /^.{0,12}?(?:抽出|抽選|抽中|贈送|送出)\s*/,
  // 冒號是必要的:「獎勵:X」才是欄位名前綴,
  // 「好禮 x1」的「好禮」是獎勵名稱本身,不可清掉(2026-11-19 測試抓到)
  /^(?:獎勵|好禮|贈品)\s*[:：]\s*/,
  /^[\s・•·,、\-—]+/
];
// 括號內容長這樣就是名額/次數附註,可以清
const NOTE_IN_PAREN = /限領|限一次|限 ?\d+ ?次|每人|每帳號|每位|名額|數量有限|隨機|不重複/;
const TAIL_PATTERNS = [
  // 「共N名」是名額附註不是獎勵數量,要清掉。
  // 數字含中文與全角(「共兩名」「共２名」)——2026-11-19 使用者截圖的案例。
  /\s*[,、,]?\s*共\s*[\d０-９一二兩三四五六七八九十]+\s*(?:名|位|份|組|個|人)\s*$/,
  /\s*[,、。!！]\s*$/
];

function stripNoteParens(text) {
  return text
    .replace(/（([^（）]*)）\s*$/, (m, inner) => (NOTE_IN_PAREN.test(inner) ? '' : m))
    .replace(/\(([^()]*)\)\s*$/, (m, inner) => (NOTE_IN_PAREN.test(inner) ? '' : m))
    .trim();
}

export function cleanRewardName(line, maxLen = 40) {
  let t = typeof line === 'string' ? line.trim() : '';
  if (!t) return '';
  const original = t;

  // 先用「獲得/領取」切:取最後一個之後的內容,那才是獎勵本體
  const verbs = [...t.matchAll(GET_VERB)];
  if (verbs.length) {
    const last = verbs[verbs.length - 1];
    const after = t.slice(last.index + last[0].length).trim();
    if (after.length >= 2) t = after;
  }

  for (const re of LEAD_PATTERNS) t = t.replace(re, '').trim();
  // 附註括號與「共N名」可能同時出現,反覆清到不再變化
  for (let i = 0; i < 3; i++) {
    const before = t;
    t = stripNoteParens(t);
    for (const re of TAIL_PATTERNS) t = t.replace(re, '').trim();
    if (t === before) break;
  }
  t = t.replace(/\s{2,}/g, ' ').trim();
  // 清到剩不到兩個字就是清壞了,還原
  return (t.length >= 2 ? t : original).slice(0, maxLen);
}

// 一行獎勵 → { name, delivery }
// fallbackText:獎勵行裡找不到線索時拿整篇文案再找一次
// (「【留言送解碼器】」這種寫在標題的情況)
// title:標題單獨再給一次,用寬鬆規則認(「梗圖創作抽好禮」「抽出新角色」)
export function parseRewardLine(line, fallbackText = '', title = '') {
  const raw = String(line ?? '').trim();
  // 「厄之章服裝選擇箱 ×1／留言就抽」:斜線左邊是獎勵、右邊是發放方式
  const slash = /^(.+?)\s*[／\/]\s*(.+)$/.exec(raw);
  let namePart = raw;
  let deliveryHint = raw;
  if (slash && /抽|送|贈|領/.test(slash[2]) && slash[2].length <= 12) {
    namePart = slash[1].trim();
    deliveryHint = slash[2].trim();
  }

  let delivery = classifyDelivery(deliveryHint);
  if (delivery === DELIVERY.UNKNOWN && deliveryHint !== raw) delivery = classifyDelivery(raw);
  // 標題的線索比整篇可靠,先問標題
  if (delivery === DELIVERY.UNKNOWN && title) delivery = classifyDeliveryLoose(title);
  if (delivery === DELIVERY.UNKNOWN && fallbackText) delivery = classifyDelivery(fallbackText);
  if (delivery === DELIVERY.UNKNOWN && fallbackText) delivery = classifyDeliveryLoose(fallbackText);

  return { name: cleanRewardName(namePart), delivery, raw };
}

// 同一則貼文裡,其他行已經標出方式、只剩某幾行未標示時,讓它們繼承。
// 條件:已標示的方式只有一種。同時有抽與送就不猜(猜錯比留白糟)。
export function inheritDelivery(items = []) {
  const known = new Set(items.map((i) => i.delivery).filter((d) => d && d !== DELIVERY.UNKNOWN));
  if (known.size !== 1) return items;
  const only = Array.from(known)[0];
  return items.map((i) => (i.delivery === DELIVERY.UNKNOWN ? { ...i, delivery: only } : i));
}

// 整則活動的發放方式總結:同時有抽與送就是「兩種都有」
export function summarizeDelivery(items = []) {
  const set = new Set(items.map((i) => i.delivery).filter((d) => d && d !== DELIVERY.UNKNOWN));
  if (!set.size) return DELIVERY.UNKNOWN;
  if (set.size === 1) return Array.from(set)[0];
  return '兩種都有';
}

// 整理成報表的一列。只放使用者這次要的欄位,不多塞。
export function toActivityRow(post) {
  const rewardLines = extractRewardLines(post.message);
  const title = extractTitle(post.message);
  // 整篇文案 + 標題當 fallback:發放方式常常寫在標題(【留言送解碼器】、抽出新角色)
  const rewards = inheritDelivery(
    rewardLines.map((l) => parseRewardLine(l, post.message, title))
  );
  return {
    id: post.id || '',
    date: post.createdTime ? String(post.createdTime).slice(0, 10) : '',
    title,
    rewardLines,
    rewards,
    delivery: summarizeDelivery(rewards),
    rewardCount: rewards.length,
    comments: post.comments ?? 0,
    reactions: post.reactions ?? 0,
    shares: post.shares ?? 0,
    permalink: post.permalink || ''
  };
}

const CSV_HEADERS = ['發布日期', '活動標題', '獎勵名稱', '發放方式', '獎勵項目數', '留言數', '心情數', '分享數', '貼文連結'];

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function activityCsv(rows = []) {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      r.date, r.title,
      r.rewards.map((x) => x.name).join('\n'),
      r.rewards.map((x) => x.delivery).join('\n'),
      r.rewardCount,
      r.comments, r.reactions, r.shares, r.permalink
    ].map(csvCell).join(','));
  }
  // BOM:Excel 開啟才不會把 UTF-8 中文讀成亂碼
  return '\uFEFF' + lines.join('\r\n');
}
