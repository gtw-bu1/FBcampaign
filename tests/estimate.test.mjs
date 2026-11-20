// 預估功能的測試。案例用真實的獎勵品項與寫法。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDraft, estimate, matchItem, parseQty, splitRewardPieces,
  durationDays, periodFactor, latestPeriod, BASELINE
} from '../src/estimate.mjs';

test('基準表有該有的東西', () => {
  assert.ok(BASELINE.activities.length >= 50, '活動數');
  assert.ok(BASELINE.items.length >= 20, '品項數');
  assert.ok(Object.keys(BASELINE.periodBaseline).length >= 4, '期間基準');
  // 基準表不可以宣稱自己是參與人數
  assert.ok(BASELINE.caveats.some((c) => c.includes('不等於活動參與人數')));
});

test('拆解獎勵名稱與數量', () => {
  assert.deepEqual(parseQty('活動解碼器 ×3'), { name: '活動解碼器', qty: '3' });
  assert.deepEqual(parseQty('覺醒齒輪箱1個'), { name: '覺醒齒輪箱', qty: '1' });
  assert.deepEqual(parseQty('當季王牌角色'), { name: '當季王牌角色', qty: '' });
  assert.deepEqual(splitRewardPieces('超A解碼器*7＋末日解碼器*5'), ['超A解碼器*7', '末日解碼器*5']);
});

test('品項對得到基準表(全形半形與「級」字差異要容忍)', () => {
  assert.equal(matchItem('活動解碼器', '3').item, '活動解碼器');
  // 「超A解碼器」是使用者說的錯字,正規化後是「超A級解碼器」
  assert.ok(matchItem('超A解碼器', '3').item.includes('解碼器'));
  assert.equal(matchItem('完全沒聽過的東西', '1'), null);
});

test('初判:從文案抽出獎勵、參與方式、發放方式', () => {
  const message = [
    '【測試活動】留言送解碼器🎁',
    '🔥活動方式:在貼文下方留言並附上遊戲截圖',
    '活動獎勵:活動解碼器 ×3',
    '活動時間:12/01 ~ 12/14'
  ].join('\n');
  const d = detectDraft(message, { start: '2026-12-01', end: '2026-12-14' });
  assert.equal(d.isCampaign, true);
  assert.equal(d.difficulty, '要附截圖');
  assert.equal(d.delivery, '留言就送');
  assert.equal(d.duration, 14);
  assert.equal(d.rewards[0].name, '活動解碼器');
  assert.equal(d.rewards[0].qty, '3');
  assert.equal(d.rewards[0].matchedItem, '活動解碼器');
});

test('檔期天數含頭尾', () => {
  assert.equal(durationDays('2026-12-01', '2026-12-14'), 14);
  assert.equal(durationDays('2026-12-01', '2026-12-01'), 1);
  assert.equal(durationDays('', '2026-12-01'), null);
  assert.equal(durationDays('2026-12-14', '2026-12-01'), null);
});

test('時間校正方向正確:基礎熱度下降,舊活動要往下調', () => {
  // 2025H1 基準 7、2026H2 基準 3 → 2025 的活動換算到現在要變小
  const f = periodFactor('2025-03-01', '2026-09-01');
  assert.ok(f < 1, `應該小於 1,實際 ${f}`);
  assert.ok(latestPeriod().startsWith('2026'));
});

test('預估:有對標就給得出數字與來源', () => {
  const message = '【測試】留言就送\n活動獎勵:活動解碼器 ×3\n在貼文下方留言參加';
  const d = detectDraft(message, { start: '2026-12-01', end: '2026-12-14' });
  const r = estimate(d, { publishDate: '2026-12-01' });
  assert.equal(r.ok, true);
  assert.ok(r.expected > 0);
  assert.ok(r.low <= r.expected && r.expected <= r.high, '區間要包住預期值');
  assert.ok(r.comparables.length > 0, '要列出對標活動');
  assert.ok(r.basis.length > 5, '要說得出憑什麼');
  assert.ok(r.explain.length >= 2);
  // 不可以宣稱是參與人數
  assert.ok(r.caveat.includes('不是活動參與人數'));
});

test('預估:對標活動要帶校正後的數字與連結', () => {
  const d = detectDraft('活動獎勵:災厄之章服裝選擇箱 ×1\n留言參加', { start: '2026-12-01', end: '2026-12-07' });
  const r = estimate(d, { publishDate: '2026-12-01' });
  assert.equal(r.tier.startsWith('item'), true, '同品項應該有足夠樣本,實際 tier=' + r.tier);
  for (const c of r.comparables) {
    assert.ok(c.date && c.comments >= 0 && c.adjustedComments >= 0);
    assert.ok(Number.isFinite(c.factor));
  }
});

test('季節係數預設不套用,打開才算', () => {
  const d = detectDraft('活動獎勵:活動解碼器 ×3\n留言參加', { start: '2026-11-01', end: '2026-11-14' });
  const off = estimate(d, { publishDate: '2026-11-01', useSeasonFactor: false });
  const on = estimate(d, { publishDate: '2026-11-01', useSeasonFactor: true });
  assert.equal(off.seasonApplied, false);
  if (off.season?.factor) {
    assert.equal(on.seasonApplied, true);
    assert.notEqual(on.expected, off.expected);
  }
});

test('獎勵對不到品項時要警告,不可以裝作有把握', () => {
  const d = detectDraft('活動獎勵:完全沒用過的神秘禮物 ×1\n留言參加', { start: '2026-12-01', end: '2026-12-07' });
  const r = estimate(d, { publishDate: '2026-12-01' });
  assert.equal(r.ok, true);
  assert.ok(r.warnings.some((w) => w.includes('對不到')), '要提醒對不到品項');
});

test('使用者手動改品項後,對標群要跟著換', () => {
  const d = detectDraft('活動獎勵:神秘禮物 ×1\n留言參加', { start: '2026-12-01', end: '2026-12-07' });
  const auto = estimate(d, { publishDate: '2026-12-01' });
  const manual = estimate(d, { publishDate: '2026-12-01', itemKeys: ['7-11禮券200元｜1'] });
  assert.notEqual(manual.basis, auto.basis);
  assert.ok(manual.expected > 0);
});

test('改參與方式一定要影響預估(門檻越高留言越少)', () => {
  // 2026-11-20 實測抓到的問題:同方式樣本不足時退層,結果改了參與方式數字卻沒變
  const base = '活動獎勵:活動解碼器 ×3\n在貼文下方留言';
  const easy = detectDraft(base, { start: '2026-12-01', end: '2026-12-14' });
  const hard = { ...easy, difficulty: '要附截圖' };
  const a = estimate(easy, { publishDate: '2026-12-01' });
  const b = estimate(hard, { publishDate: '2026-12-01' });
  assert.equal(easy.difficulty, '只要留言');
  assert.ok(b.expected < a.expected,
    `要附截圖(${b.expected})應該低於只要留言(${a.expected})`);
  assert.ok(b.wayFactor < 1, '要有校正係數');
  assert.ok(b.explain.some((x) => x.includes('參與方式校正')), '要說明做了校正');
});

test('樣本不足的參與方式不硬套係數,改成警告', () => {
  const d = detectDraft('活動獎勵:活動解碼器 ×3\n留言參加', { start: '2026-12-01', end: '2026-12-07' });
  const r = estimate({ ...d, difficulty: '要錄影片' }, { publishDate: '2026-12-01' });
  assert.equal(r.wayFactor, 1);
  assert.ok(r.warnings.some((w) => w.includes('要錄影片')));
});
