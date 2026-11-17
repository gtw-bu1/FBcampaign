import test from 'node:test';
import assert from 'node:assert/strict';
import { localInputValue, toUnixSeconds, inputBounds, defaultInputValue, validateScheduleInput, MIN_AHEAD_SECONDS, MAX_AHEAD_SECONDS } from '../src/schedule.mjs';

const NOW = new Date('2026-11-17T12:00:00').getTime(); // 本地時間基準

test('localInputValue 輸出本地時間格式,不是 UTC', () => {
  assert.equal(localInputValue(NOW), '2026-11-17T12:00');
});

test('localInputValue 與 toUnixSeconds 來回換算一致', () => {
  const value = localInputValue(NOW);
  assert.equal(toUnixSeconds(value), Math.floor(NOW / 1000));
});

test('toUnixSeconds 遇到空值或亂字串回 null', () => {
  assert.equal(toUnixSeconds(''), null);
  assert.equal(toUnixSeconds('不是時間'), null);
  assert.equal(toUnixSeconds(undefined), null);
});

test('inputBounds 的下限比 10 分鐘多一點緩衝,上限是 30 天', () => {
  const { min, max } = inputBounds(NOW);
  assert.ok(toUnixSeconds(min) > Math.floor(NOW / 1000) + MIN_AHEAD_SECONDS);
  assert.equal(toUnixSeconds(max), Math.floor((NOW + MAX_AHEAD_SECONDS * 1000) / 1000));
});

test('預設時間是 30 分鐘後,且通過驗證', () => {
  const value = defaultInputValue(NOW);
  assert.equal(value, '2026-11-17T12:30');
  assert.equal(validateScheduleInput(value, NOW), '');
});

test('太近的時間被攔下', () => {
  const value = localInputValue(NOW + 5 * 60 * 1000);
  assert.match(validateScheduleInput(value, NOW), /10 分鐘/);
});

test('超過 30 天被攔下', () => {
  const value = localInputValue(NOW + 31 * 24 * 60 * 60 * 1000);
  assert.match(validateScheduleInput(value, NOW), /30 天/);
});

test('格式不對被攔下', () => {
  assert.match(validateScheduleInput('明天下午', NOW), /格式/);
});

test('剛好 10 分鐘後算合法(邊界)', () => {
  const value = localInputValue(NOW + MIN_AHEAD_SECONDS * 1000);
  assert.equal(validateScheduleInput(value, NOW), '');
});
