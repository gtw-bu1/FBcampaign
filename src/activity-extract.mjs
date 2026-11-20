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

// --- 2026-11-20:把混進獎勵欄的說明文字擋掉 ---
//
// 實測 45 則活動貼文,有 13 則的獎勵欄抓到不是獎勵的東西。原因是「活動獎勵」
// 四個字常出現在句子中間(「完成投稿皆可獲得活動獎勵超A級解碼器」)或條款裡
// (「本活動獎勵價值未達中獎稅標準」),於是後面接的是文案或注意事項,
// 而那些行**沒有任何欄位名可以當停止點**,只靠 STOP_PATTERNS 攔不住。
//
// 真實被誤抓的例子:
//   「2. 所有得獎者須於2025/12/15 23:59前回填領獎資料…」(大會考,抓了 7 行條款)
//   「在8/23 23:59前,留言處寫下你的答案!」(災厄學堂 11 則)
//   「讓我們一起回顧《災厄之章》的危機真相!」
//   「✨活動表單:https://forms.gamania.com/…」
//   「,千萬別錯過囉👋」
//
// 判法用兩層,順序很重要:
//   1. 強雜訊(條款用語、編號開頭、網址、呼籲句)→ 直接丟。
//   2. 既沒有數量標記(×3、*1、5個)也沒有獎勵詞 → 當說明丟掉。
// 第 2 層不能寫進第 1 層:「7-11禮券200元x1(共兩名得獎者)」含「得獎者」,
// 但它是真的獎勵;有數量標記就該留下。
const STRONG_NOISE = [
  /https?:\/\//,
  /^\s*\d+\s*[.、]/,                     // 「2. 所有得獎者須…」條款編號
  /折換現金|主辦單位|視同放棄|寄送地址|申報|中獎稅|不予補發|無法重新申請|轉換、轉讓/,
  /留言處|寫下你的答案|把握機會|一起回顧|千萬別|別錯過|請務必|敬請期待/,
  /活動表單|報名表單|詳情請見|詳見官網|活動頁面/
];
// 數量標記。先經 normalizeNumbers,否則全角「＊１」比不到
const QTY_MARK = /[×xX*＊✕]\s*\d+|\d+\s*(?:個|份|張|組|名|位|日|天|次|元|套|點)/;
// 這個粉專的獎勵常見詞。沒有數量標記時靠它救(「2026馬年棒球噴漆」)
const REWARD_WORDS = /解碼器|Pass|禮券|選擇箱|寶箱|箱|勳章|噴漆|服裝|武器|角色|等待室|齒輪|顏料|造型|稱號|點數|金幣|序號|好運綻放/;

export function isNoiseLine(line) {
  const t = normalizeNumbers(line).trim();
  if (!t) return true;
  if (STRONG_NOISE.some((re) => re.test(t))) return true;
  if (!QTY_MARK.test(t) && !REWARD_WORDS.test(t)) return true;
  return false;
}

// 貼文是不是我們要的活動貼文:文案裡有「活動獎勵」四個字
export function hasRewardField(message) {
  return typeof message === 'string' && message.includes(REWARD_FIELD);
}

// --- 2026-11-20 使用者指出漏抓很多:靠欄位名認活動貼文行不通 ---
//
// 她舉的例子:「【18周年慶系列活動】寫下回憶送服裝角色解碼器 ×3」用的是
// 「🎁 參加獎勵:」而不是「活動獎勵:」。查了全部 321 則貼文,
// **寫成「活動獎勵:」的只有 31 則**,其他各種寫法:
//   「獎勵:」6 則、「皆可獲得獎勵:」2 則、「投票獎勵:」「參加獎勵:」「獲得以下好禮:」各 1 則。
// 更麻煩的是**很多根本沒有欄位名**,獎勵直接寫在句子裡:
//   「🎁留言就送:超A解碼器*7＋末日解碼器*5」(留言 1731)
//   「🎁留言就抽:[末日] 震天龍砲（永久）*1」(留言 794)
//   「就抽兩位幸運兒分別獲得:🎁夜之魔女露娜(永久)*1」(留言 350)
// 這批全是高互動的留言活動,漏掉它們等於整份分析都不可信。
//
// 改成看語意:**要求玩家互動 + 給得出獎勵物品**就是活動貼文。
const INTERACTION = /留言|截圖|投稿|標記朋友|標記好友|分享你|分享並|分享完成|問卷|表單|投票|競猜|命名|錄下|錄製|張貼/;
const REWARD_HINT = /獎勵|好禮|贈品|禮物|物資|送你|送給|就送|就抽|留言抽|留言送|抽出|抽獎|帶走|獲得|抽\s*\d/;
// 維護公告、純販售宣傳要排除
const NOT_CAMPAIGN = /伺服器.{0,8}維護|臨時維護|維護公告|停機/;

export function isCampaignPost(message) {
  const t = normalizeNumbers(message || '');
  if (!t.trim()) return false;
  if (NOT_CAMPAIGN.test(t) && !INTERACTION.test(t)) return false;
  if (!INTERACTION.test(t)) return false;
  if (!REWARD_HINT.test(t)) return false;
  return REWARD_WORDS.test(t) || QTY_MARK.test(t);
}

// --- 活動難度:使用者要的「留言活動/要投稿/附上圖片/附上影片」 ---
//
// 由難到易判,先中的優先。附影片最難、純留言最容易。
export const DIFFICULTY = {
  VIDEO: '要錄影片',
  IMAGE: '要附截圖',
  POST: '要投稿創作',
  FORM: '填問卷表單',
  VOTE: '投票/按表情',
  COMMENT: '只要留言',
  NONE: '不用互動（直接發放）'
};

export function classifyDifficulty(message) {
  const t = String(message ?? '');
  if (!INTERACTION.test(t)) return DIFFICULTY.NONE;
  if (/錄下|錄製|錄影|影片|短片/.test(t)) return DIFFICULTY.VIDEO;
  if (/截圖|附上圖|附圖|遊戲畫面|照片|梗圖|上傳.{0,6}圖/.test(t)) return DIFFICULTY.IMAGE;
  if (/投稿|創作|作品|繪圖|手繪|同人/.test(t)) return DIFFICULTY.POST;
  if (/問卷|表單/.test(t)) return DIFFICULTY.FORM;
  if (/投票|按下對應表情|按表情|用表情/.test(t)) return DIFFICULTY.VOTE;
  if (/留言|張貼/.test(t)) return DIFFICULTY.COMMENT;
  return DIFFICULTY.NONE;
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
// 獎勵區塊的引導詞,按優先序試。「獎勵」最泛,放最後。
// 來自 2026-11-20 對 321 則真實貼文的統計(見 isCampaignPost 的註解)。
//
// **只有「欄位格式」才算引導詞**:後面要緊跟冒號或換行。
// 不然「【末日戰力集結｜全服解鎖獎勵】」的「獎勵」會命中標題,
// 從標題後面開始抓,結果抓到活動說明句(2026-11-20 實測)。
const REWARD_FIELDS = [
  '活動獎勵', '參加獎勵', '參與獎勵', '獎勵內容', '活動好禮', '參加好禮',
  '得獎獎勵', '投票獎勵', '皆可獲得獎勵', '獲得以下好禮', '獎勵'
];

function fieldAt(text, field) {
  let from = 0;
  for (;;) {
    const idx = text.indexOf(field, from);
    if (idx < 0) return -1;
    const after = text.slice(idx + field.length);
    // 後面可以有空白,接著必須是冒號或換行,才是欄位名
    if (/^[\s]*[:：\n]/.test(after)) return idx;
    from = idx + field.length;
  }
}

// 沒有任何引導詞時,掃全文找出像獎勵的行。
// 「🎁留言就送:超A解碼器*7＋末日解碼器*5」這種寫法沒有欄位名,只能這樣抓。
function isRewardLine(line) {
  if (isNoiseLine(line)) return false;
  const t = normalizeNumbers(line);
  // 以冒號結尾的是引導句不是獎勵本身(「就抽兩位幸運兒分別獲得:」)
  if (/[:：]\s*$/.test(t)) return false;
  // 很長又沒有數量標記的是說明句
  // (「現在就秀出你的武器戰友「永耀烈陽・熾」…解鎖全服獎勵!」2026-11-20 實測)
  if (t.length > 40 && !QTY_MARK.test(t)) return false;
  if (!(REWARD_WORDS.test(t) || QTY_MARK.test(t))) return false;
  // 要有獎勵語意,否則「販售時間只到11/25」這種也會被收進來
  return /獎|送|抽|贈|領|獲得|帶走|物資|好禮|禮物/.test(t);
}

function collectFrom(lines, maxLines) {
  const out = [];
  // 第一行:去掉開頭的冒號、空白、裝飾符號
  const firstInline = lines[0].replace(/^[\s:：\-—、。]+/, '').trim();
  if (firstInline && !isStopLine(firstInline) && !isNoiseLine(firstInline)) out.push(firstInline);

  // 掃描窗口上限 14 行:雜訊行是 continue 而不是 break,沒有窗口就可能
  // 一路掃到文末撿到無關的東西
  const WINDOW = 14;
  for (let i = 1; i < lines.length && i <= WINDOW && out.length < maxLines; i++) {
    const t = lines[i].trim();
    if (!t) {
      // 空行:已經收到內容就結束,還沒收到就繼續找(欄位名與內容之間可能空一行)
      if (out.length) break;
      continue;
    }
    if (isStopLine(t)) break;
    if (isNoiseLine(t)) continue;
    out.push(t);
  }
  return out;
}

export function extractRewardLines(message, maxLines = 8) {
  const text = typeof message === 'string' ? message : '';
  if (!text) return [];

  for (const field of REWARD_FIELDS) {
    const idx = fieldAt(text, field);
    if (idx < 0) continue;
    const out = collectFrom(text.slice(idx + field.length).split('\n'), maxLines);
    if (out.length) return out;
  }
  // 完全沒有引導詞:掃全文
  return text.split('\n').filter(isRewardLine).slice(0, maxLines).map((l) => l.trim());
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
  DIRECT: '直接發放',
  DRAW_NO_COMMENT: '抽獎（非留言）',
  UNKNOWN: '未標示'
};

// 非留言型活動標「留言就送」會自我矛盾(2026-11-20:「18週年慶序號大放送」
// 因為標題有「大放送」被判留言就送,但那則根本不用留言)。
// 呈現時換成中性說法,判定邏輯本身不動。
export function relabelForNonComment(delivery) {
  if (delivery === DELIVERY.GIVE) return DELIVERY.DIRECT;
  if (delivery === DELIVERY.DRAW) return DELIVERY.DRAW_NO_COMMENT;
  return delivery;
}

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

// 標題/整篇文案用的寬鬆版:嚴格規則跑完還是不知道時用。
// 「送」那一側也要有(2026-11-20):標題寫「清明追思送禮物」「遊玩馬年史詩送好運」
// 「末日物資發放」的貼文,獎勵行只有獎勵名稱,嚴格規則一律判不出來。
const LOOSE_GIVE = /送|贈|發放|放送|領取/;

export function classifyDeliveryLoose(text) {
  const strict = classifyDelivery(text);
  if (strict !== DELIVERY.UNKNOWN) return strict;
  const t = normalizeNumbers(text);
  if (LOOSE_DRAW.test(t) && !NOT_LOTTERY.test(t)) return DELIVERY.DRAW;
  if (LOOSE_GIVE.test(t)) return DELIVERY.GIVE;
  return DELIVERY.UNKNOWN;
}

// --- 2026-11-20 使用者確認:非留言型活動不該跟留言型放在一起比 ---
//
// 「🎉18週年慶序號大放送!」那 7 則留言數 0~6,因為獎勵是直接發序號、
// 根本不用留言。把它們混進平均值會把「留言就送」的成效拉低一大截。
// 判法:文案要求留言/標記/分享才算留言型。
export function isCommentDriven(message) {
  const t = String(message ?? '');
  return /留言|回覆本篇|回覆這篇|標記好友|tag\s*好友/i.test(t);
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
const GET_VERB = /(?:獲得|領取|拿到|得到)[\s:：]*/g;
const LEAD_PATTERNS = [
  // 「完成投稿皆可獲得活動獎勵超A級解碼器 × 5」切完後會剩「活動獎勵」當開頭
  /^活動獎勵[\s:：]*/,
  // 開頭的【標題】。「【末日小確幸】分享你的覺醒系統組合,就送覺醒齒輪*3」
  // 後面必須還有內容:「【末日解碼器*5】」整個被括起來的是獎勵名本身,不可清掉
  /^【[^】]{0,20}】(?=.)\s*/,
  // 「💥貼文留言獎:」「🏅【投稿獎】」這種獎項名
  /^[^:：\n]{0,12}獎[\s:：]+/,
  // 「就有機會抽中:災厄之章服裝選擇箱 ×1」→ 清掉「就有機會抽中:」。
  // **前面不可以有括號**:「幻夢道長－薇薇安*1(抽出1位)」的「抽出」在括號裡,
  // 清掉的話獎勵名稱整個不見,只剩「1位)」(2026-11-20 實測)
  /^[^（(]{0,14}?(?:抽出|抽選|抽中|贈送|送出)[\s:：]*/,
  // 「分享你的覺醒系統組合,就送」「就可以帶走」這類句尾動詞
  /^[^（(]{0,20}?(?:就送|就抽|送你|送給|帶走|可得)[\s:：]*/,
  // 「留言就送超A級服裝角色解碼器*3」的前綴
  /^留言(?:就|即|後|處)?(?:送|抽|贈|領|中)[\s:：]*/,
  // 冒號是必要的:「獎勵:X」才是欄位名前綴,
  // 「好禮 x1」的「好禮」是獎勵名稱本身,不可清掉(2026-11-19 測試抓到)
  /^(?:獎勵|好禮|贈品)\s*[:：]\s*/,
  /^[\s・•·,、\-—:：]+/
];
// 括號內容長這樣就是名額/時程附註,可以清。
// **不含「永久」「N日」「N天」**——那是獎勵屬性,體驗型與永久型的魅力度差很多。
const NOTE_IN_PAREN = /限領|限一次|限 ?\d+ ?次|限制獲得|每人|每位|每\s*個?帳號|名額|數量有限|隨機|不重複|共\s*[\d一二兩三四五六七八九十]+\s*[名位]|得獎者|抽出|抽\s*\d|發放|維護|暱稱|登場/;
const TAIL_PATTERNS = [
  // 「共N名」是名額附註不是獎勵數量,要清掉。
  // 數字含中文與全角(「共兩名」「共２名」)——2026-11-19 使用者截圖的案例。
  /[\s\uFF0C,、]*共\s*[\d０-９一二兩三四五六七八九十]+\s*(?:名|位|份|組|個|人)\s*$/,
  // 「邪靈碎岩VI*1,抽一位獲得」的尾巴(2026-11-20 實測)
  /[\s\uFF0C,、]*抽\s*[\d一二三四五六七八九十]*\s*(?:位|名|人)?\s*(?:獲得|得到|領取)?\s*$/,
  // 「妖刀村雨VI*1 一位」的「一位」
  /[\s\uFF0C,、]+[\d一二三四五六七八九十]+\s*(?:位|名)\s*$/,
  // 語尾助詞:「喬露*1 (永久) 唷」
  /\s*[唷喔囉啦呀哦吧呦]+\s*$/,
  // 全角逗號要用 \uFF0C 明寫,之前直接貼全角字元沒生效,尾巴殘留「,」
  /[\s\uFF0C,、。!！;；]+$/
];

function stripNoteParens(text) {
  return text
    .replace(/（([^（）]*)）\s*$/, (m, inner) => (NOTE_IN_PAREN.test(inner) ? '' : m))
    .replace(/\(([^()]*)\)\s*$/, (m, inner) => (NOTE_IN_PAREN.test(inner) ? '' : m))
    .trim();
}

// 尾部的 emoji 與裝飾符號。要先清掉,否則「（共3名神槍手）✨」的括號不在行尾,
// 名額附註就清不掉(2026-11-20 實測災厄學堂 11 則全中)
function stripTailDecor(text) {
  return text.replace(/[\s\u2190-\u21FF\u2600-\u27BF\uFE0F\u{1F000}-\u{1FAFF}]+$/u, '').trim();
}

export function cleanRewardName(line, maxLen = 40) {
  let t = typeof line === 'string' ? line.trim() : '';
  if (!t) return '';
  const original = t;

  // 先用「獲得/領取」切:取最後一個之後的內容,那才是獎勵本體。
  // 但**括號裡的「獲得」不算切點**(2026-11-20 實測兩個真實案例):
  //   「超A服裝角色解碼器*10（每個帳號限制獲得1次）」→ 會切出「1次）」
  //   「邪靈碎岩VI*1，抽一位獲得（11/26發放）」    → 會切出「（11/26發放）」
  const verbs = [...t.matchAll(GET_VERB)];
  if (verbs.length) {
    const last = verbs[verbs.length - 1];
    const after = t.slice(last.index + last[0].length).trim();
    const closesParen = /[）)]\s*$/.test(after) && !/[（(]/.test(after);  // 切點在括號內
    const wrapped = /^[（(].*[）)]$/.test(after);                        // 切出來整個是括號
    if (after.length >= 2 && !closesParen && !wrapped) t = after;
  }

  for (const re of LEAD_PATTERNS) t = t.replace(re, '').trim();
  // 附註括號、「共N名」、尾部裝飾可能交錯出現,反覆清到不再變化
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = stripTailDecor(t);
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
  let rewards = inheritDelivery(
    rewardLines.map((l) => parseRewardLine(l, post.message, title))
  );
  const commentDriven = isCommentDriven(post.message);
  if (!commentDriven) {
    rewards = rewards.map((r) => ({ ...r, delivery: relabelForNonComment(r.delivery) }));
  }
  return {
    id: post.id || '',
    date: post.createdTime ? String(post.createdTime).slice(0, 10) : '',
    title,
    rewardLines,
    rewards,
    delivery: summarizeDelivery(rewards),
    rewardCount: rewards.length,
    commentDriven,
    difficulty: classifyDifficulty(post.message),
    comments: post.comments ?? 0,
    reactions: post.reactions ?? 0,
    shares: post.shares ?? 0,
    permalink: post.permalink || ''
  };
}

const CSV_HEADERS = ['發布日期', '活動標題', '獎勵名稱', '發放方式', '活動類型', '活動難度', '獎勵項目數', '留言數', '心情數', '分享數', '貼文連結'];

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
      r.commentDriven ? '留言互動型' : '非留言型(直接發放)',
      r.difficulty || '',
      r.rewardCount,
      r.comments, r.reactions, r.shares, r.permalink
    ].map(csvCell).join(','));
  }
  // BOM:Excel 開啟才不會把 UTF-8 中文讀成亂碼
  return '\uFEFF' + lines.join('\r\n');
}
