import test from 'node:test';
import assert from 'node:assert/strict';
import {
  median, quantile, countHashtags, lengthBucket, extractFeatures,
  summarizeHistory, forecastEngagement, MIN_SAMPLE
} from '../src/post-forecast.mjs';
import { parseLimit, normalizePost, readGraphError } from '../api/page-insights.js';

const post = (over = {}) => ({
  id: over.id || 'p1', message: over.message ?? '一般長度的貼文內容',
  createdTime: over.createdTime || '2026-11-01T10:00:00+0800',
  permalink: '', hasImage: over.hasImage ?? true,
  reactions: over.reactions ?? 10, comments: over.comments ?? 2, shares: over.shares ?? 1,
  engagement: (over.reactions ?? 10) + (over.comments ?? 2) + (over.shares ?? 1)
});

test('median 對偶數筆取中間兩筆平均,且不受離群值影響', () => {
  assert.equal(median([1, 2, 3, 4]), 3); // (2+3)/2 = 2.5 -> 四捨五入 3
  assert.equal(median([5, 5, 5, 99999]), 5);
  assert.equal(median([]), null);
});

test('quantile 算得出第 25 與 75 百分位', () => {
  const v = [10, 20, 30, 40];
  assert.equal(quantile(v, 0.25), 18);
  assert.equal(quantile(v, 0.75), 33);
  assert.equal(quantile([7], 0.5), 7);
});

test('countHashtags 只數井號標籤', () => {
  assert.equal(countHashtags('來玩 #CSO #絕對武力 活動'), 2);
  assert.equal(countHashtags('沒有標籤'), 0);
  assert.equal(countHashtags(null), 0);
});

test('lengthBucket 以 100 / 300 字切三段', () => {
  assert.equal(lengthBucket(50), '短');
  assert.equal(lengthBucket(100), '中');
  assert.equal(lengthBucket(300), '中');
  assert.equal(lengthBucket(301), '長');
});

test('extractFeatures 抽出圖片、長度、標籤與時段', () => {
  const f = extractFeatures({ message: 'a'.repeat(120) + ' #tag', hasImage: true, createdTime: '2026-11-01T14:30:00+0800' });
  assert.equal(f.hasImage, true);
  assert.equal(f.lengthBucket, '中');
  assert.equal(f.hashtags, 1);
  assert.equal(f.hour, 14);
});

test('summarizeHistory 回傳中位數與最佳貼文', () => {
  const s = summarizeHistory([
    post({ id: 'a', reactions: 10 }),
    post({ id: 'b', reactions: 100 }),
    post({ id: 'c', reactions: 20, hasImage: false })
  ]);
  assert.equal(s.count, 3);
  assert.equal(s.best.id, 'b');
  assert.equal(s.withImage, 2);
  assert.equal(s.withoutImage, 1);
});

test('沒有歷史資料時明確回報無法預估,不給假數字', () => {
  const r = forecastEngagement([], { message: '測試', hasImage: true });
  assert.equal(r.ok, false);
  assert.match(r.reason, /沒有可用的歷史貼文/);
});

test('樣本足夠時用「同圖片類型 + 同長度」那一群', () => {
  const history = [];
  for (let i = 0; i < 5; i++) history.push(post({ id: `img${i}`, message: 'a'.repeat(150), reactions: 30 }));
  for (let i = 0; i < 5; i++) history.push(post({ id: `txt${i}`, message: 'a'.repeat(150), hasImage: false, reactions: 5 }));
  const r = forecastEngagement(history, { message: 'b'.repeat(150), hasImage: true });
  assert.equal(r.ok, true);
  assert.equal(r.tier, 'image+length');
  assert.equal(r.sampleSize, 5);
  assert.equal(r.expected, 33); // 30 + 2 + 1
  assert.match(r.basis, /有圖/);
});

test('同長度樣本不足時退到「同圖片類型」並說明', () => {
  const history = [];
  for (let i = 0; i < 4; i++) history.push(post({ id: `s${i}`, message: 'a'.repeat(20), reactions: 40 }));
  history.push(post({ id: 'long', message: 'a'.repeat(500), reactions: 60 }));
  const r = forecastEngagement(history, { message: 'b'.repeat(500), hasImage: true });
  assert.equal(r.tier, 'image');
  assert.equal(r.sampleSize, 5);
  assert.match(r.basis, /退一層/);
});

test('同圖片類型也不足時退到全體', () => {
  const history = [post({ id: 'a', reactions: 10 }), post({ id: 'b', reactions: 20 }), post({ id: 'c', reactions: 30 })];
  const r = forecastEngagement(history, { message: '純文字草稿', hasImage: false });
  assert.equal(r.tier, 'all');
  assert.match(r.basis, /整體/);
});

test('信心等級依樣本數分級', () => {
  const many = Array.from({ length: 12 }, (_, i) => post({ id: `m${i}`, message: 'a'.repeat(150), reactions: 10 }));
  assert.equal(forecastEngagement(many, { message: 'b'.repeat(150), hasImage: true }).confidence, 'high');
  const few = Array.from({ length: MIN_SAMPLE }, (_, i) => post({ id: `f${i}`, message: 'a'.repeat(150), reactions: 10 }));
  assert.equal(forecastEngagement(few, { message: 'b'.repeat(150), hasImage: true }).confidence, 'medium');
});

test('預估一定附帶免責說明,不讓人當成保證', () => {
  const history = Array.from({ length: 5 }, (_, i) => post({ id: `h${i}`, message: 'a'.repeat(150) }));
  const r = forecastEngagement(history, { message: 'b'.repeat(150), hasImage: true });
  assert.match(r.caveat, /不是保證/);
});

// --- api/page-insights.js ---

test('parseLimit 給預設值並夾住上限', () => {
  assert.equal(parseLimit(undefined), 50);
  assert.equal(parseLimit('0'), 50);
  assert.equal(parseLimit('abc'), 50);
  assert.equal(parseLimit('10'), 10);
  assert.equal(parseLimit('500'), 100);
});

test('normalizePost 把 Graph 的巢狀 summary 壓平並算出互動總數', () => {
  const n = normalizePost({
    id: '1_2', message: '嗨', created_time: '2026-11-01T10:00:00+0000',
    full_picture: 'https://x/y.jpg',
    reactions: { summary: { total_count: 12 } },
    comments: { summary: { total_count: 3 } },
    shares: { count: 2 }
  });
  assert.equal(n.reactions, 12);
  assert.equal(n.comments, 3);
  assert.equal(n.shares, 2);
  assert.equal(n.engagement, 17);
  assert.equal(n.hasImage, true);
});

test('normalizePost 對缺欄位的貼文補 0,不產生 NaN', () => {
  const n = normalizePost({ id: '1_3' });
  assert.equal(n.engagement, 0);
  assert.equal(n.hasImage, false);
  assert.equal(n.message, '');
});

test('readGraphError 把權限不足講成可行動的訊息', () => {
  assert.match(readGraphError({ error: { code: 200, message: 'x' } }, 403), /pages_read_engagement/);
  assert.match(readGraphError({ error: { code: 190, message: 'x' } }, 401), /權杖已失效/);
  assert.match(readGraphError({ error: { code: 100, message: 'x' } }, 400), /已被 Meta 停用/);
});
