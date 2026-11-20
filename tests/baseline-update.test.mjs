// 一鍵更新基準的測試。重點是:
//   1. 重算出來的結構跟打包進去那份一致(欄位不能漏,不然預估會爆)
//   2. 品類對照有套用
//   3. 沒把握的獎勵要列進 unclassified 讓營運指定,**不可以自己猜一個品類**
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBaseline, parseQty, splitRewardPieces } from '../src/baseline-build.mjs';
import { normalizeItemName, needsCategory, BUILTIN_ALIASES, REWARD_CATEGORIES } from '../src/reward-aliases.mjs';
import { mergeAliases } from '../api/baseline.js';
import { estimate, detectDraft } from '../src/estimate.mjs';
import BASELINE from '../src/campaign-baseline.mjs';

const post = (date, message, comments, extra = {}) => ({
  id: 'p' + date, message, createdTime: date + 'T10:00:00+0800',
  comments, reactions: 10, shares: 1, permalink: 'https://fb.test/' + date, ...extra
});

const SAMPLE = [
  // 活動貼文:同一個獎勵辦三次
  post('2026-09-01', '【活動A】留言送好禮\n活動獎勵:活動解碼器 ×3\n在貼文下方留言', 200),
  post('2026-09-15', '【活動B】留言送好禮\n活動獎勵:活動解碼器 ×3\n在貼文下方留言', 150),
  post('2026-10-01', '【活動C】留言送好禮\n活動獎勵:活動解碼器 ×3\n在貼文下方留言', 250),
  // 每季換的道具:名稱不同,需要品類對照
  post('2026-08-01', '【活動D】留言抽新角色\n活動獎勵:妖刀村雨VI*1\n留言參加', 300),
  post('2026-07-01', '【活動E】留言抽\n活動獎勵:全新角色小花*1\n留言參加', 120),
  // 非活動貼文:用來算粉專基礎熱度
  post('2026-09-05', '今天維護完成,大家快上線', 4),
  post('2026-09-07', '新版本預告', 6),
  post('2026-08-10', '改版公告', 3)
];

test('重算出來的結構跟內建那份一致', () => {
  const b = buildBaseline(SAMPLE, { generatedAt: '2026-11-20' });
  for (const key of ['generatedAt', 'source', 'caveats', 'overallMedian', 'periodBaseline',
    'monthly', 'difficulty', 'delivery', 'items', 'activities']) {
    assert.ok(key in b, `少了 ${key}`);
    assert.ok(key in BASELINE, `內建那份少了 ${key}`);
  }
  assert.equal(b.monthly.length, 12);
  assert.ok(b.activities.length >= 5);
  assert.ok(b.caveats.some((c) => c.includes('不等於活動參與人數')));
});

test('粉專基礎熱度只算非活動貼文', () => {
  const b = buildBaseline(SAMPLE);
  // 2026H2 的非活動貼文留言是 4、6、3 → 中位數 4
  assert.equal(b.periodBaseline['2026H2'].median, 4);
  assert.equal(b.periodBaseline['2026H2'].n, 3);
});

test('同一個獎勵辦三次會累積成一個品項', () => {
  const b = buildBaseline(SAMPLE);
  const item = b.items.find((i) => i.item === '活動解碼器' && String(i.qty) === '3');
  assert.ok(item, '要有活動解碼器 ×3');
  assert.equal(item.posts, 3);
  assert.equal(item.median, 200);
  assert.notEqual(item.grade, '樣本不足');
});

test('品類對照有套用:妖刀村雨VI 併進當期超越武器', () => {
  const b = buildBaseline(SAMPLE);
  assert.ok(b.items.some((i) => i.item === '當期超越武器'), '要歸成當期超越武器');
  assert.ok(!b.items.some((i) => i.item.includes('妖刀村雨')), '不該留原始道具名');
});

test('沒把握的新道具列進 unclassified,不可以自己猜品類', () => {
  const b = buildBaseline(SAMPLE);
  const names = b.unclassified.map((u) => u.name);
  assert.ok(names.some((n) => n.includes('全新角色小花')), '新道具要列出來等人指定');
  // 不可以被硬塞成某個品類
  assert.ok(!b.items.some((i) => i.item === '當季王牌角色' && i.posts === 1 && i.median === 120),
    '不該自己把它歸成王牌角色');
});

test('營運指定品類之後就會併入', () => {
  const aliases = [...BUILTIN_ALIASES, { from: '全新角色小花', to: '當季王牌角色' }];
  const b = buildBaseline(SAMPLE, { aliases });
  assert.ok(b.items.some((i) => i.item === '當季王牌角色'));
  assert.ok(!b.unclassified.some((u) => u.name.includes('全新角色小花')));
});

test('解碼器這類固定道具不需要分類', () => {
  assert.equal(needsCategory('活動解碼器'), false);
  assert.equal(needsCategory('7-11禮券200元'), false);
  assert.equal(needsCategory('Season Pass'), false);
  assert.equal(needsCategory('某某新武器'), true);
  // 通用詞不可以當品項
  assert.equal(needsCategory('獎勵'), false);
});

test('品類對照不接受不在清單裡的值(前端不能塞任意字串)', () => {
  const merged = mergeAliases([{ from: '測試道具', to: '當季王牌角色' }, { from: '壞資料', to: '隨便亂打' }]);
  assert.ok(merged.some((a) => a.from === '測試道具'));
  assert.ok(!merged.some((a) => a.from === '壞資料'));
  assert.ok(merged.length >= BUILTIN_ALIASES.length);
});

test('通用詞不會被當成對照來源(否則所有獎勵會被歸成同一類)', () => {
  assert.equal(normalizeItemName('獎勵', [{ from: '獎勵', to: '當季王牌角色' }]), '獎勵');
});

test('更新後的基準表可以直接餵進預估', () => {
  const b = buildBaseline(SAMPLE, { generatedAt: '2026-11-20' });
  const d = detectDraft('【新活動】留言送\n活動獎勵:活動解碼器 ×3\n在貼文下方留言',
    { start: '2026-12-01', end: '2026-12-07', base: b });
  const r = estimate(d, { publishDate: '2026-12-01', base: b });
  assert.equal(r.ok, true);
  assert.ok(r.expected > 0);
  assert.ok(r.comparables.length >= 3);
  assert.equal(REWARD_CATEGORIES.length >= 5, true);
});
