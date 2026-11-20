// 獎勵品類對照表。
//
// 為什麼需要:每季會換的道具(王牌角色、超越武器、噴漆…)名稱每次都不同,
// 不歸類的話每個都是「只辦過一次」,永遠累積不出樣本。
// 歸類需要遊戲知識(妖刀村雨VI 是超越武器、永耀烈陽・熾是史詩武器),
// **程式判不出來,只有營運知道**。
//
// 下面這些是從營運 2026-11-20 人工整理的對照表反推出來的,
// 而且只收「同一天候選唯一、可以確定」的;反推時有 18 筆同日期多個候選無法確定、
// 3 筆明顯配錯(例如「超A解碼器」被配到「末日解碼器」),那些一律不收——
// **寧可留白讓人補,不要猜一個錯的進去**。
//
// 新道具在面板上一鍵更新後會列成「待分類」,營運點一下指定,存在瀏覽器裡累積。

// 品類選項:營運正規化時用的名稱
export const REWARD_CATEGORIES = [
  '當季王牌角色',
  '當期超越武器',
  '當季史詩武器',
  '當季末日武器',
  '限定噴漆',
  '限定等待室標記',
  '限定勳章',
  '活動限定勳章',
  // 2026-11-20 線上實測:2024-12 有「Switch Lite」,實體獎品原本沒有對應品類
  '實體獎品'
];

// 內建對照(原始道具名 → 品類)
export const BUILTIN_ALIASES = [
  { from: '維拉．塔莉卡', to: '當季王牌角色' },
  { from: '幻夢道長－薇薇安', to: '當季王牌角色' },
  { from: '8/6全新王牌角色', to: '當季王牌角色' },
  { from: '永耀烈陽・熾', to: '當季史詩武器' },
  { from: '邪靈碎岩VI', to: '當期超越武器' },
  { from: '妖刀村雨VI', to: '當期超越武器' },
  { from: '[末日] 震天龍砲', to: '當季末日武器' },
  { from: '好運綻放等待室', to: '限定噴漆' }
];

const norm = (s) => String(s ?? '').replace(/\s/g, '')
  .replace(/[（(][^）)]*[）)]/g, '')          // 去掉（永久）這類附註再比對
  .replace(/[×xX＊*]\s*\d+$/, '')
  .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30));

// 這些是通用詞,不可以當對照的來源(會把所有東西都歸成同一類)
const TOO_GENERIC = /^(獎勵|好禮|贈品|禮物|物資|獎品)$/;

// 抓壞的獎勵名稱,不要拿去煩營運分類(2026-11-20 線上實測,待分類清單裡混進這些:
// 「條件:8/19維護後…」「加入官方帳號」「預計抽出兩位」「幸運兒共兩名發放下列末日物資」)
const NOT_A_REWARD = /條件|維護後|維護前|加入官方|官方帳號|活動時間|有上線|抽出|達標|以下|以上|留言數|就領|幸運兒|讓大家|投票|發放下列|預計|共\s*[\d一二兩三四五六七八九十]+\s*[名位]/;

// 性質不同、不該混進基準的活動(營運判斷後排除)。
// 2026-11-20:「末日戰力集結｜全服解鎖獎勵」是依**全服留言總數**解鎖階梯獎勵,
// 跟「個人留言就送/就抽」不是同一種機制,留言數不可比。
export const EXCLUDED_ACTIVITIES = [
  { date: '2026-07-22', titleHas: '末日戰力集結' }
];

export function isExcludedActivity({ date = '', title = '' } = {}) {
  return EXCLUDED_ACTIVITIES.some((x) =>
    (!x.date || x.date === date) && (!x.titleHas || String(title).includes(x.titleHas)));
}

export function normalizeItemName(name, aliases = BUILTIN_ALIASES) {
  const raw = String(name ?? '').trim();
  if (!raw || TOO_GENERIC.test(raw)) return raw;
  const want = norm(raw);
  if (!want) return raw;
  for (const a of aliases) {
    const k = norm(a.from);
    if (!k) continue;
    if (want === k || want.includes(k) || k.includes(want)) return a.to;
  }
  return raw;
}

// 判斷一個獎勵名「需不需要營運指定品類」:
// 名稱裡有具體道具名(含中文全名、羅馬數字版本號、角色名)而且對不到任何對照,
// 通常就是新一季的道具。解碼器、Pass、禮券這類固定道具不需要分類。
const STABLE_ITEMS = /解碼器|Pass|禮券|選擇箱|寶箱|齒輪|樂豆|點數|金幣|序號|箱子|等待室標記|勳章/;

export function needsCategory(name, aliases = BUILTIN_ALIASES) {
  const raw = String(name ?? '').trim();
  if (!raw || raw.length < 2 || TOO_GENERIC.test(raw)) return false;
  // 太長的通常是整句文案被當成獎勵名,不是真的道具
  if (raw.length > 18) return false;
  if (NOT_A_REWARD.test(raw)) return false;
  if (STABLE_ITEMS.test(raw)) return false;
  if (REWARD_CATEGORIES.includes(raw)) return false;
  return normalizeItemName(raw, aliases) === raw;
}
