import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRewardField, extractTitle, extractRewardLines, extractRewardText,
  toActivityRow, activityCsv
} from '../src/activity-extract.mjs';

// 使用者 2026-11-19 給的實例,是這組功能的驗收標準
const REAL = `【中秋送好禮🌕】維拉．塔莉卡陪你一起過中秋💕

活動獎勵
參與活動即可獲得活動解碼器 ×3（每帳號限領 1 次）
參與玩家中抽出 維拉．塔莉卡 x1  共1名

活動時間
2026/09/15 - 2026/09/30

注意事項
每人限中獎一次`;

test('認得出含「活動獎勵」的貼文', () => {
  assert.equal(hasRewardField(REAL), true);
  assert.equal(hasRewardField('今天天氣真好'), false);
  assert.equal(hasRewardField(''), false);
  assert.equal(hasRewardField(null), false);
});

test('第一行就是活動標題,emoji 要保留', () => {
  assert.equal(extractTitle(REAL), '【中秋送好禮🌕】維拉．塔莉卡陪你一起過中秋💕');
});

test('標題前有空行時會跳過空行', () => {
  assert.equal(extractTitle('\n\n【標題】內容'), '【標題】內容');
});

test('獎勵內容抓出兩行,看得出「送」與「抽」兩種發放方式', () => {
  const lines = extractRewardLines(REAL);
  assert.equal(lines.length, 2, `應該兩行,實際 ${lines.length} 行:${JSON.stringify(lines)}`);
  assert.match(lines[0], /即可獲得活動解碼器/);
  assert.match(lines[1], /抽出 維拉．塔莉卡/);
});

test('獎勵內容不可吃到「活動時間」或「注意事項」', () => {
  const text = extractRewardText(REAL);
  assert.ok(!text.includes('活動時間'), '吃到活動時間了');
  assert.ok(!text.includes('2026/09/15'), '吃到日期了');
  assert.ok(!text.includes('注意事項'), '吃到注意事項了');
});

test('「活動獎勵:」同一行就寫內容的也抓得到', () => {
  const lines = extractRewardLines('【活動】來了\n活動獎勵:解碼器 x3\n活動時間:11/20');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /解碼器 x3/);
  assert.ok(!lines[0].includes('活動時間'));
});

test('欄位名與內容之間有空行也抓得到', () => {
  const lines = extractRewardLines('【活動】\n活動獎勵\n\n解碼器 x3\n\n活動時間\n11/20');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /解碼器/);
});

test('遇到下一個【區塊】就停', () => {
  const lines = extractRewardLines('【A】\n活動獎勵\n好禮 x1\n【B】另一個活動\n好禮 x2');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /好禮 x1/);
});

test('遇到 hashtag 區就停', () => {
  const lines = extractRewardLines('【A】\n活動獎勵\n好禮 x1\n#CSO #絕對武力');
  assert.equal(lines.length, 1);
});

test('沒有「活動獎勵」四個字就回空陣列,不瞎猜', () => {
  assert.deepEqual(extractRewardLines('【公告】維護通知\n今晚停機'), []);
  assert.deepEqual(extractRewardLines(''), []);
});

test('獎勵行數有上限,避免整篇貼文被吃進來', () => {
  const many = '【A】\n活動獎勵\n' + Array.from({ length: 30 }, (_, i) => `獎勵${i}`).join('\n');
  assert.ok(extractRewardLines(many).length <= 8);
});

test('toActivityRow 給出使用者要的四樣:日期、標題、獎勵、留言數', () => {
  const row = toActivityRow({
    id: 'p1', message: REAL, createdTime: '2026-09-15T10:00:00+0800',
    comments: 165, reactions: 80, shares: 12, permalink: 'https://x'
  });
  assert.equal(row.date, '2026-09-15');
  assert.match(row.title, /中秋送好禮/);
  assert.equal(row.rewardCount, 2);
  assert.equal(row.comments, 165);
});

test('CSV 有 BOM,多行獎勵用引號包住不會破壞欄位', () => {
  const row = toActivityRow({
    id: 'p1', message: REAL, createdTime: '2026-09-15T10:00:00+0800', comments: 165
  });
  const csv = activityCsv([row]);
  assert.ok(csv.startsWith('\uFEFF'), '要有 BOM');
  assert.ok(csv.includes('"參與活動即可獲得活動解碼器'), '多行內容要被引號包住');
  assert.ok(csv.includes('留言數'));
  assert.ok(!csv.includes('參與人數'), 'FB 給不了參與人數,欄位名不可這樣寫');
});

test('CSV 空資料也回得出表頭', () => {
  assert.ok(activityCsv([]).includes('活動標題'));
});
