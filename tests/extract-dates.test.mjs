// 從文案抓活動檔期。案例全部是從粉專真實貼文複製下來的寫法。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractDates, detectDraft } from '../src/estimate.mjs';

test('完整日期格式', () => {
  assert.deepEqual(
    pick('🕜活動時間：2026/09/02 14:00～ 2026/09/16 10:00'),
    { start: '2026-09-02', end: '2026-09-16' });
  assert.deepEqual(
    pick('✨活動時間：2026-07-08 維護後 ~ 2026-07-22 維護前'),
    { start: '2026-07-08', end: '2026-07-22' });
  assert.deepEqual(
    pick('活動時間：2026/07/22～2026/08/26維護前'),
    { start: '2026-07-22', end: '2026-08-26' });
  assert.deepEqual(
    pick('🕛活動時間：2026/2/11 14:00 ~ 2026/3/4 23:59'),
    { start: '2026-02-11', end: '2026-03-04' });
});

test('只有月日的短格式,用參考日期的年份', () => {
  assert.deepEqual(
    pick('🔥活動時間：8/19維護後 - 9/9 維護前', '2026-08-15'),
    { start: '2026-08-19', end: '2026-09-09' });
  assert.deepEqual(
    pick('📅 活動時間：9/9 維護後 ～ 9/23 維護前', '2026-09-01'),
    { start: '2026-09-09', end: '2026-09-23' });
  assert.deepEqual(
    pick('🕛活動時間：4/1 ~ 4/15 23:59', '2026-03-28'),
    { start: '2026-04-01', end: '2026-04-15' });
  assert.deepEqual(
    pick('📅 活動期間：6/3～6/9', '2026-06-01'),
    { start: '2026-06-03', end: '2026-06-09' });
});

test('跨年的活動,結束日要往後推一年', () => {
  assert.deepEqual(
    pick('活動時間：12/20 ~ 1/5', '2026-12-18'),
    { start: '2026-12-20', end: '2027-01-05' });
});

test('「即日起」開頭:抓到的那個日期是結束日,開始日用預計發布日', () => {
  const r = extractDates('📅 活動時間：即日起 ～ 9/16（三）維護前', { refDate: '2026-08-25' });
  assert.equal(r.start, '2026-08-25');
  assert.equal(r.end, '2026-09-16');
});

test('沒有日期範圍的句子不要誤抓', () => {
  assert.equal(extractDates('活動期間內天天20:00、20:30都有限時道具等著你帶回家🎁').start, '');
  assert.equal(extractDates('活動期間每天登入獲得定時-BOX').start, '');
  assert.equal(extractDates('完全沒提到時間的文案').start, '');
});

test('「7-11禮券200元」不可以被當成日期', () => {
  const r = extractDates('活動獎勵：7-11禮券200元x1\n沒有活動時間那一行');
  assert.equal(r.start, '');
});

test('初判會自己把檔期填好,並標明是從文案抓的', () => {
  const message = [
    '【測試活動】留言送好禮🎁',
    '🔥活動時間：12/01 維護後 - 12/14 維護前',
    '活動獎勵：活動解碼器 ×3',
    '在貼文下方留言參加'
  ].join('\n');
  const d = detectDraft(message);
  assert.equal(d.start, String(new Date().getFullYear()) + '-12-01');
  assert.equal(d.end, String(new Date().getFullYear()) + '-12-14');
  assert.equal(d.duration, 14);
  assert.equal(d.dateFromText, true);
  assert.ok(d.dateSource.includes('活動時間'));
});

test('呼叫方給了日期就以它為準(使用者手動改過)', () => {
  const message = '活動時間：12/01 - 12/14\n活動獎勵：活動解碼器 ×3\n留言參加';
  const d = detectDraft(message, { start: '2026-01-05', end: '2026-01-20' });
  assert.equal(d.start, '2026-01-05');
  assert.equal(d.end, '2026-01-20');
});

function pick(line, refDate = '2026-06-01') {
  const r = extractDates(line, { refDate });
  return { start: r.start, end: r.end };
}
