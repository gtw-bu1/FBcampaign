import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPost, typeBreakdown, hasDiscriminativePower, typeLabel } from '../src/post-types.mjs';
import { median, forecastEngagement } from '../src/post-forecast.mjs';

// 使用者 2026-11-18 口述的兩類對比,是這次改版的驗收標準
// 2026-11-18 使用者提供的「他粉專實際用字」,這批是校準的主要依據
test('使用者提供的留言互動型用字全部判對', () => {
  const cases = [
    '【活動方式】在貼文下方留言你最愛的武器',
    '活動獎勵:艾莉造型永久序號 x 3',
    '活動時間:11/20 - 11/30',
    '活動辦法請見下方說明',
    '參加方式很簡單',
    '抽獎名單公布!',
    '留言抽序號'
  ];
  for (const c of cases) {
    const r = classifyPost(c);
    assert.equal(r.id, 'comment-driven', `判錯:${c} → ${r.label}`);
  }
});

test('使用者提供的日常宣傳型用字全部判對', () => {
  const cases = [
    '【速報】新武器登場',
    '【快報】改版內容搶先看',
    '新造型販售中',
    '限時特價開賣',
    '商城上架新商品',
    '改版預告',
    '維護公告',
    '最新宣傳影片',
    '新手攻略'
  ];
  for (const c of cases) {
    const r = classifyPost(c);
    assert.equal(r.id, 'announcement', `判錯:${c} → ${r.label}`);
  }
});

test('「活動」兩字太泛,不可單獨觸發留言互動型', () => {
  // 「活動預告」其實是宣傳,不該被當成活動辦法貼文
  assert.equal(classifyPost('本次活動預告搶先看').id, 'announcement');
  // 但列出結構化欄位的就是真的活動辦法貼文
  assert.equal(classifyPost('活動預告!活動方式:留言即可參加').id, 'comment-driven');
});

test('留言抽獎類被判為留言互動型', () => {
  const cases = [
    '留言抽序號！三名幸運兒帶走艾莉造型',
    '在下方留言 +1 就有機會拿到武器序號',
    '活動辦法:留言並標記兩位好友',
    '抽獎活動開始!快來參加',
    '猜猜答案是什麼,答對就送'
  ];
  for (const c of cases) {
    const r = classifyPost(c);
    assert.equal(r.id, 'comment-driven', `判錯:${c} → ${r.label}`);
    assert.ok(r.matched, '要說得出命中什麼');
  }
});

test('日常宣傳類被判為日常宣傳型', () => {
  const cases = [
    '【改版預告】新地圖即將上線',
    '本週維護公告:11/20 凌晨停機',
    '最新宣傳影片來了,一起看',
    '新手攻略懶人包,一次看懂',
    '敬請期待下週的驚喜'
  ];
  for (const c of cases) {
    const r = classifyPost(c);
    assert.equal(r.id, 'announcement', `判錯:${c} → ${r.label}`);
  }
});

test('留言互動的訊號優先於預告:同時出現時算留言互動型', () => {
  // 一則貼文可以同時是活動預告又要求留言;「要不要留言」對留言數的影響更大
  const r = classifyPost('【改版預告】新地圖上線!留言抽新造型序號');
  assert.equal(r.id, 'comment-driven');
});

test('單純「歡迎留言討論」不算留言互動型', () => {
  // 沒有抽獎/贈送的動作,不該被當成留言活動
  const r = classifyPost('新地圖你最喜歡哪一張?歡迎留言討論');
  assert.notEqual(r.id, 'comment-driven');
});

test('分享抽獎被判為分享型,不是留言型', () => {
  assert.equal(classifyPost('公開分享本文就有機會抽中好禮').id, 'share-driven');
  assert.equal(classifyPost('填寫報名表單即可參加').id, 'share-driven');
});

test('沒有特徵的貼文歸為其他,不硬塞類型', () => {
  const r = classifyPost('今天天氣真好');
  assert.equal(r.id, 'other');
  assert.equal(r.matched, '');
});

test('空白或非字串安全處理', () => {
  assert.equal(classifyPost('').id, 'other');
  assert.equal(classifyPost(null).id, 'other');
  assert.equal(classifyPost(undefined).id, 'other');
});

// --- 分群效果 ---

const mk = (over) => ({
  id: over.id, message: over.message, hasImage: over.hasImage ?? true,
  reactions: over.reactions ?? 10, comments: over.comments ?? 2, shares: over.shares ?? 1,
  engagement: (over.reactions ?? 10) + (over.comments ?? 2) + (over.shares ?? 1),
  permalink: ''
});

// 模擬使用者描述的真實情況:抽獎文留言多、轉發文留言少
function mixedHistory() {
  const posts = [];
  for (let i = 0; i < 5; i++) posts.push(mk({ id: `g${i}`, message: '留言抽序號!', reactions: 60, comments: 300, shares: 20 }));
  for (let i = 0; i < 6; i++) posts.push(mk({ id: `a${i}`, message: '【改版預告】新地圖上線', reactions: 30, comments: 3, shares: 2 }));
  return posts;
}

test('抽獎文的預估只看抽獎文,不被宣傳文拉低', () => {
  const r = forecastEngagement(mixedHistory(), { message: '留言抽新造型!', hasImage: true });
  assert.equal(r.ok, true);
  assert.equal(r.typeId, 'comment-driven');
  assert.equal(r.sampleSize, 5, '只能用 5 則抽獎文');
  assert.equal(r.expectedComments, 300);
  assert.match(r.basis, /留言互動型/);
});

test('宣傳文的預估只看宣傳文,不被抽獎文拉高', () => {
  const r = forecastEngagement(mixedHistory(), { message: '新版本宣傳影片上線', hasImage: true });
  assert.equal(r.typeId, 'announcement');
  assert.equal(r.sampleSize, 6);
  assert.equal(r.expectedComments, 3);
});

test('改版前的混算會失真:兩類預估值必須明顯不同', () => {
  const gift = forecastEngagement(mixedHistory(), { message: '留言抽序號', hasImage: true });
  const ann = forecastEngagement(mixedHistory(), { message: '改版預告', hasImage: true });
  assert.ok(gift.expected > ann.expected * 5, `抽獎文預估(${gift.expected})應該遠高於宣傳文(${ann.expected})`);
});

test('使用者可以手動指定類型,覆寫自動判斷', () => {
  const r = forecastEngagement(mixedHistory(), { message: '今天天氣真好', hasImage: true, typeId: 'comment-driven' });
  assert.equal(r.typeId, 'comment-driven');
  assert.equal(r.typeIsManual, true);
  assert.equal(r.typeAuto.id, 'other', '要保留自動判斷的結果供對照');
});

test('同類型樣本不足時退一層並說明剩幾則', () => {
  const posts = [mk({ id: 'x', message: '留言抽', reactions: 5 }), mk({ id: 'y', message: '預告', reactions: 5 }), mk({ id: 'z', message: '預告2', reactions: 5 })];
  const r = forecastEngagement(posts, { message: '留言抽獎', hasImage: true });
  assert.equal(r.tier, 'all');
  assert.match(r.basis, /同類型只有 1 則/);
});

test('typeBreakdown 列出各類型的留言中位數', () => {
  const b = typeBreakdown(mixedHistory(), median);
  const gift = b.find((x) => x.id === 'comment-driven');
  const ann = b.find((x) => x.id === 'announcement');
  assert.equal(gift.count, 5);
  assert.equal(gift.medianComments, 300);
  assert.equal(ann.medianComments, 3);
});

test('各類型留言數有明顯差異時判定分類有鑑別力', () => {
  assert.equal(hasDiscriminativePower(typeBreakdown(mixedHistory(), median)), true);
});

test('各類型留言數差不多時判定沒有鑑別力,不要假裝變準了', () => {
  const flat = [];
  for (let i = 0; i < 4; i++) flat.push(mk({ id: `g${i}`, message: '留言抽', comments: 10 }));
  for (let i = 0; i < 4; i++) flat.push(mk({ id: `a${i}`, message: '預告', comments: 10 }));
  assert.equal(hasDiscriminativePower(typeBreakdown(flat, median)), false);
});

test('樣本不足時鑑別力回 null,而不是 false', () => {
  const few = [mk({ id: 'a', message: '留言抽', comments: 10 })];
  assert.equal(hasDiscriminativePower(typeBreakdown(few, median)), null);
});

test('預估會附上同類型最高的幾則供對照', () => {
  const r = forecastEngagement(mixedHistory(), { message: '留言抽序號', hasImage: true });
  assert.ok(r.samples.length > 0);
  assert.ok(r.samples[0].engagement >= r.samples[r.samples.length - 1].engagement);
  assert.ok('comments' in r.samples[0]);
});

test('typeLabel 對未知 id 回原字串,不丟錯', () => {
  assert.equal(typeLabel('comment-driven'), '留言互動型');
  assert.equal(typeLabel('nonexistent'), 'nonexistent');
});
