import test from 'node:test';
import assert from 'node:assert/strict';
import { taipeiTime, normalizeScheduled } from '../api/scheduled-posts.js';

test('排程時間轉成台北時間', () => {
  // 2026-11-25 14:00:00 +08:00 = 1795586400
  assert.match(taipeiTime(1795586400), /2026\/11\/25 14:00/);
  assert.equal(taipeiTime(0), '');
  assert.equal(taipeiTime(undefined), '');
  assert.equal(taipeiTime('abc'), '');
});

test('整理排程貼文,並標出時間已過卻還沒發出的異常', () => {
  const now = 1795586400; // 2026-11-25 14:00 台北
  const future = normalizeScheduled({
    id: '1_2', message: '【和艾莉的秋冬約會】', scheduled_publish_time: now + 3600, full_picture: 'https://x/y.jpg'
  }, now);
  assert.equal(future.overdue, false);
  assert.equal(future.id, '1_2');
  assert.equal(future.picture, 'https://x/y.jpg');
  assert.match(future.atText, /2026\/11\/25 15:00/);

  // 2026-11-25 的診斷頁上真的有一則 2023/12/13 的排程貼文卡在佇列裡,
  // 這種「時間早就過了還在佇列」一定要在畫面上標出來,不能靜靜列著。
  const stuck = normalizeScheduled({ id: '1_3', message: '【1213 #改版懶人包】', scheduled_publish_time: 1702448400 }, now);
  assert.equal(stuck.overdue, true);

  assert.equal(normalizeScheduled(null), null);
  const noTime = normalizeScheduled({ id: '1_4' }, now);
  assert.equal(noTime.at, 0);
  assert.equal(noTime.overdue, false);
  assert.equal(noTime.atText, '');
  assert.equal(noTime.message, '');
});
