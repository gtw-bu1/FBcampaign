// 貼文類型分類:決定「拿哪些歷史貼文來預估這一則」。
//
// 為什麼需要:2026-11-18 使用者回報預估很不準,原因講得很清楚——
//   「我粉專有些是純分享文(不太會有留言),但留言送禮物的活動通常會有很多人留言。
//     單純的活動預告/影片轉發是日常宣傳,不應該拿來跟活動貼文一起評估。」
// 原本用「有圖/沒圖 + 文案長度」分群,把抽獎文和轉發文混在一起算中位數,兩邊都失真。
//
// **這張關鍵字表的來源與限制(重要,不要當成已驗證的事實):**
// 目前的關鍵字來自使用者上述口述(留言抽、留言送、活動預告、影片轉發),
// **尚未用該粉專的真實文案逐則校準**。所以:
//   1. 分類結果一律顯示在畫面上(含命中的關鍵字),讓使用者看得到哪裡分錯。
//   2. 使用者可以手動改這一則的類型,不被自動判斷綁死。
//   3. 校準方式:看 /api/page-insights 回傳的 typeBreakdown,
//      若某類的留言中位數跟其他類沒有明顯差異,就表示這個分類沒有鑑別力,要重新設計。

// 順序有意義:從最明確的訊號排到最弱的,第一個命中就決定類型。
// 「留言互動」要排在最前面——一則貼文可以同時是活動預告又要求留言,
// 而「要不要留言」對留言數的影響遠大於「是不是預告」。
export const POST_TYPES = [
  {
    id: 'comment-driven',
    label: '留言互動型',
    hint: '要求留言才能參加,留言數通常遠高於其他類型',
    // 「留言」單獨出現不算(例如「歡迎留言討論」),要搭配抽獎/贈送/標記的動作才算
    patterns: [
      /留言[^。！\n]{0,12}(抽|送|serial|序號|兌換|領取|參加|\+1|加1)/,
      /(抽|送)[^。！\n]{0,12}留言/,
      /留言\s*[+＋]\s*1/,
      /(tag|標註|標記|@)[^。！\n]{0,10}(朋友|好友|同伴|隊友|戰友)/i,
      /(抽獎|抽出|得獎|中獎|幸運兒)/,
      /(猜[^。！\n]{0,8}(答案|謎|看|是什麼))/
    ]
  },
  {
    id: 'share-driven',
    label: '分享/填表型',
    hint: '要求分享貼文或填表單,互動集中在分享數',
    patterns: [
      /(分享|轉發)[^。！\n]{0,12}(抽|送|參加|活動|貼文)/,
      /(公開分享|分享本文|分享這篇)/,
      /(填寫|填單|報名表|google\s*form|問卷)/i
    ]
  },
  {
    id: 'announcement',
    label: '日常宣傳型',
    hint: '預告、改版、影片轉發等單向宣傳,通常留言不多',
    patterns: [
      /(預告|搶先看|即將|敬請期待|coming\s*soon)/i,
      /(改版|更新|維護|停機|開服|上線|開放)/,
      /(公告|通知|提醒|說明)/,
      /(影片|預告片|trailer|直播|實況)/i,
      /(攻略|教學|介紹|懶人包)/
    ]
  }
];

export const DEFAULT_TYPE = { id: 'other', label: '其他', hint: '沒有命中任何類型特徵' };

// 回傳 { id, label, hint, matched } ;matched 是命中的那段文字,用來在畫面上解釋判斷依據。
export function classifyPost(message) {
  const text = typeof message === 'string' ? message : '';
  if (!text.trim()) return { ...DEFAULT_TYPE, matched: '' };
  for (const type of POST_TYPES) {
    for (const re of type.patterns) {
      const m = re.exec(text);
      if (m) {
        return { id: type.id, label: type.label, hint: type.hint, matched: m[0].slice(0, 24) };
      }
    }
  }
  return { ...DEFAULT_TYPE, matched: '' };
}

export function typeLabel(id) {
  if (id === DEFAULT_TYPE.id) return DEFAULT_TYPE.label;
  return POST_TYPES.find((t) => t.id === id)?.label || id;
}

// 每個類型各有幾則、留言與互動的中位數。
// **這是檢驗分類有沒有鑑別力的依據**:若各類的留言中位數差不多,分類就是白做的。
export function typeBreakdown(posts = [], medianFn) {
  const groups = new Map();
  for (const p of posts) {
    if (!p || !Number.isFinite(p.engagement)) continue;
    const id = p.typeId || classifyPost(p.message).id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(p);
  }
  return Array.from(groups.entries())
    .map(([id, list]) => ({
      id,
      label: typeLabel(id),
      count: list.length,
      medianComments: medianFn(list.map((p) => p.comments)),
      medianEngagement: medianFn(list.map((p) => p.engagement))
    }))
    .sort((a, b) => b.count - a.count);
}

// 各類型的留言中位數是否真的有差異。沒有差異就該在畫面上說「這個分類看不出鑑別力」,
// 而不是讓使用者以為預估變準了。
export function hasDiscriminativePower(breakdown = []) {
  const usable = breakdown.filter((b) => b.count >= 3 && Number.isFinite(b.medianComments));
  if (usable.length < 2) return null;            // 樣本不足,無法判斷
  const values = usable.map((b) => b.medianComments);
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === 0) return false;
  return (max - min) / max >= 0.5;               // 最高與最低差一半以上才算有鑑別力
}
