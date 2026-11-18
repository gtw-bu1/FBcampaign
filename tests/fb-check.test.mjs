import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerdict, escapeHtml, renderHtml, describeScheduled } from '../api/fb-check.js';

const PAGE_ID = '284455941624148';
const ok = (payload) => ({ ok: true, status: 200, payload });
const bad = (status, error) => ({ ok: false, status, payload: { error } });

test('粉專權杖且讀得到粉專 → 判定正確', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: PAGE_ID, name: 'CSO 絕對武力粉絲團' }),
    permissions: ok({ data: [] }),
    pageProbe: ok({ id: PAGE_ID, name: 'CSO 絕對武力粉絲團' })
  });
  assert.equal(v.kind, 'page');
  assert.match(v.verdict, /應該可以發文/);
});

test('用戶權杖但能換到粉專 → 判定可自動換取', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '某主管' }),
    accounts: ok({ data: [{ id: PAGE_ID, name: 'CSO', access_token: 'T', tasks: ['CREATE_CONTENT', 'ANALYZE', 'MANAGE'] }] }),
    permissions: ok({ data: [{ permission: 'pages_manage_posts', status: 'granted' }] })
  });
  assert.equal(v.kind, 'user-exchangeable');
  assert.match(v.verdict, /設定正確/);
});

test('任務缺 CREATE_CONTENT → 判定不能發文,並指出去哪裡改', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '系統使用者' }),
    accounts: ok({ data: [{ id: PAGE_ID, name: 'CSO', access_token: 'T', tasks: ['ANALYZE'] }] }),
    permissions: ok({ data: [{ permission: 'pages_manage_posts', status: 'granted' }] })
  });
  assert.equal(v.kind, 'no-create-content');
  assert.match(v.advice, /完全控制|編輯以上/);
});

test('任務有 CREATE_CONTENT 但缺 ANALYZE → 只警告觸及數據', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '系統使用者' }),
    accounts: ok({ data: [{ id: PAGE_ID, name: 'CSO', access_token: 'T', tasks: ['CREATE_CONTENT'] }] }),
    permissions: ok({ data: [] })
  });
  assert.equal(v.kind, 'user-exchangeable');
  assert.ok(v.rows.some((r) => r.label.includes('ANALYZE') && r.state === 'warn'));
});

test('換取後的權杖實測身分不符 → 標記為壞掉,不要說可以用', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '某人' }),
    accounts: ok({ data: [{ id: PAGE_ID, name: 'CSO', access_token: 'T', tasks: ['CREATE_CONTENT'] }] }),
    permissions: ok({ data: [] }),
    exchangedProbe: ok({ id: '999', name: '別人' })
  });
  assert.equal(v.kind, 'exchange-broken');
});

test('用戶權杖且一個粉專都管不到 → 指向粉專人員設定', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '某人' }),
    accounts: ok({ data: [] }),
    permissions: ok({ data: [] })
  });
  assert.equal(v.kind, 'user-no-pages');
  assert.match(v.advice, /粉專管理人|系統使用者/);
});

test('用戶權杖缺 pages_show_list → 明確說要加哪個權限', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '某人' }),
    accounts: bad(403, { code: 200, message: 'Missing permission' }),
    permissions: ok({ data: [] })
  });
  assert.equal(v.kind, 'user-no-list');
  assert.match(v.advice, /pages_show_list/);
});

test('管得到別的粉專但沒有這個編號 → 指出編號可能填錯', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '某人' }),
    accounts: ok({ data: [{ id: '999', name: '別的粉專', access_token: 'T' }] }),
    permissions: ok({ data: [] })
  });
  assert.equal(v.kind, 'page-not-in-list');
  assert.match(v.rows.find((r) => r.label.includes('能管理的粉專')).value, /別的粉專\(999\)/);
});

test('權杖過期 → 直接判定無法使用,不再往下查', () => {
  const v = buildVerdict({ pageId: PAGE_ID, me: bad(401, { code: 190, message: 'expired' }) });
  assert.equal(v.kind, 'invalid');
  assert.match(v.advice, /失效或過期/);
});

test('缺少 pages_manage_posts 會被標成會失敗', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '某人' }),
    accounts: ok({ data: [{ id: PAGE_ID, name: 'CSO', access_token: 'T' }] }),
    permissions: ok({ data: [{ permission: 'pages_read_engagement', status: 'granted' }] })
  });
  assert.ok(v.rows.some((r) => r.label.includes('pages_manage_posts') && r.state === 'bad'));
});

test('有排程貼文時直接回報數量與時間,並提醒 FB 日曆要切對週', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '系統使用者' }),
    accounts: ok({ data: [{ id: PAGE_ID, name: 'CSO', access_token: 'T', tasks: ['CREATE_CONTENT', 'ANALYZE'] }] }),
    permissions: ok({ data: [] }),
    exchangedProbe: ok({ id: PAGE_ID, name: 'CSO 絕對武力粉絲團' }),
    scheduled: ok({ data: [{ id: 'p1', message: '測試貼文', scheduled_publish_time: '1795000000' }] })
  });
  assert.equal(v.kind, 'has-scheduled');
  assert.match(v.verdict, /已經有 1 則排程貼文/);
  assert.match(v.advice, /那一週|今天/);
});

test('一則排程都沒有時,明說「還沒成功送出過」而不是說應該可以用', () => {
  const v = buildVerdict({
    pageId: PAGE_ID,
    me: ok({ id: '123', name: '系統使用者' }),
    accounts: ok({ data: [{ id: PAGE_ID, name: 'CSO', access_token: 'T', tasks: ['CREATE_CONTENT', 'ANALYZE'] }] }),
    permissions: ok({ data: [] }),
    exchangedProbe: ok({ id: PAGE_ID, name: 'CSO' }),
    scheduled: ok({ data: [] })
  });
  assert.equal(v.kind, 'user-exchangeable');
  assert.match(v.advice, /還沒成功送出過/);
});

test('describeScheduled 把 UNIX 秒轉成台北時間並截短文案', () => {
  const d = describeScheduled(ok({ data: [{ message: 'a'.repeat(100), scheduled_publish_time: '1795000000' }] }));
  assert.equal(d.list.length, 1);
  assert.ok(d.list[0].includes('2026'));
  assert.ok(d.list[0].length < 90);
});

test('describeScheduled 讀取失敗時回 error,不假裝沒有排程', () => {
  const d = describeScheduled(bad(403, { message: 'Permissions error' }));
  assert.match(d.error, /Permissions error/);
});

test('escapeHtml 擋掉標籤注入', () => {
  assert.equal(escapeHtml('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
});

test('renderHtml 不會把權杖內容印出來', () => {
  const html = renderHtml({ rows: [], verdict: 'v', advice: 'a', tokenHint: '200 字元,開頭 EAAQpS…' });
  assert.ok(html.includes('開頭 EAAQpS'));
  assert.ok(!html.includes('access_token='));
});
