import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractReward, extractPeriod, extractMethod, extractQuantity, extractValue,
  toRewardRow, rewardCsv
} from '../src/reward-extract.mjs';
import { groupByReward, sinceSeconds, escapeHtml } from '../api/reward-report.js';
import { classifyPost } from '../src/post-types.mjs';

// 依據使用者說的「活動方式 / 活動獎勵 / 活動時間」欄位寫法
const SAMPLE = `【和艾莉的秋冬約會】
活動方式:在本文留言你最想要的造型
活動獎勵:緋紅狂想-艾莉 (永久) x 3
活動時間:2026/11/25 - 2026/12/05
注意事項:每人限中獎一次`;

test('抓出活動獎勵,且不把下一個欄位的內容吃進來', () => {
  const r = extractReward(SAMPLE);
  assert.match(r, /緋紅狂想-艾莉/);
  assert.ok(!r.includes('活動時間'), '不可吃到下一個欄位');
});

test('抓出活動時間', () => {
  assert.match(extractPeriod(SAMPLE), /2026\/11\/25/);
});

test('抓出參加方式', () => {
  assert.match(extractMethod(SAMPLE), /留言/);
});

test('沒有欄位名時用日期區間當檔期', () => {
  assert.match(extractPeriod('快來參加!11/20~11/30 限定'), /11\/20/);
});

test('文案沒寫獎勵就回空字串,不瞎猜', () => {
  assert.equal(extractReward('今天天氣真好'), '');
  assert.equal(extractReward(''), '');
  assert.equal(extractReward(null), '');
});

test('抓出獎勵數量:x3 與「3名」兩種寫法', () => {
  assert.equal(extractQuantity('造型 x 3'), 3);
  assert.equal(extractQuantity('抽 10 名幸運兒'), 10);
  assert.equal(extractQuantity('5份好禮'), 5);
  assert.equal(extractQuantity('沒有數字'), null);
});

test('抓出獎勵金額', () => {
  assert.equal(extractValue('NT$500 商城點數'), 500);
  assert.equal(extractValue('價值 1,200 元'), 1200);
  assert.equal(extractValue('無價'), null);
});

test('toRewardRow 整理成報表的一列,含類型判定', () => {
  const row = toRewardRow({
    id: 'p1', message: SAMPLE, createdTime: '2026-11-19T10:00:00+0800',
    comments: 300, reactions: 60, shares: 20, engagement: 380, permalink: 'https://x'
  }, classifyPost);
  assert.equal(row.date, '2026-11-19');
  assert.equal(row.typeId, 'comment-driven');
  assert.equal(row.quantity, 3);
  assert.equal(row.comments, 300);
  assert.match(row.reward, /艾莉/);
});

test('groupByReward 依留言中位數排序,高的在前', () => {
  const rows = [
    { reward: '永久造型', comments: 300, engagement: 400, date: '2026-01-01' },
    { reward: '永久造型', comments: 200, engagement: 300, date: '2026-02-01' },
    { reward: '體驗3天', comments: 10, engagement: 40, date: '2026-03-01' }
  ];
  const g = groupByReward(rows);
  assert.equal(g[0].reward, '永久造型');
  assert.equal(g[0].count, 2);
  assert.equal(g[0].medianComments, 250);
  assert.equal(g[0].maxComments, 300);
  assert.equal(g[1].reward, '體驗3天');
});

test('文案沒寫獎勵的歸到「(文案沒寫獎勵)」,不會消失', () => {
  const g = groupByReward([{ reward: '', comments: 5, engagement: 9, date: '2026-01-01' }]);
  assert.equal(g[0].reward, '(文案沒寫獎勵)');
  assert.equal(g[0].count, 1);
});

test('sinceSeconds 算出幾個月前的秒數', () => {
  const now = new Date('2026-11-19T00:00:00Z').getTime();
  const s = sinceSeconds(24, now);
  const d = new Date(s * 1000);
  assert.equal(d.getUTCFullYear(), 2024);
  assert.equal(d.getUTCMonth(), 10); // 11 月(0-based)
});

test('CSV 有 BOM 讓 Excel 不亂碼,且逗號與引號會被逃脫', () => {
  const csv = rewardCsv([{
    date: '2026-11-19', typeId: 'comment-driven', reward: '造型 A, 造型 B', quantity: 2,
    value: null, period: '11/20-11/30', method: '留言', comments: 300, reactions: 60,
    shares: 20, engagement: 380, reach: null, excerpt: '他說"讚"', permalink: 'https://x'
  }], () => '留言互動型');
  assert.ok(csv.startsWith('\uFEFF'), '要有 BOM');
  assert.ok(csv.includes('"造型 A, 造型 B"'), '含逗號要加引號');
  assert.ok(csv.includes('""讚""'), '引號要加倍');
  assert.ok(csv.includes('留言互動型'));
});

test('CSV 空資料也回得出表頭', () => {
  const csv = rewardCsv([]);
  assert.ok(csv.includes('活動獎勵'));
  assert.ok(csv.includes('留言數'));
  assert.ok(!csv.includes('參與人數'), '欄位名不可寫成參與人數,FB 給不了那個數字');
});

test('escapeHtml 擋掉注入', () => {
  assert.equal(escapeHtml('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
});
