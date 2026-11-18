import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePageToken, resetTokenCache } from '../api/_pagetoken.mjs';

const PAGE_ID = '284455941624148';

// 假的 Graph:依路徑回傳預設好的結果
function fakeGraph(routes) {
  return async (path) => {
    for (const [pattern, result] of Object.entries(routes)) {
      if (path.startsWith(pattern)) return result;
    }
    return { ok: false, status: 404, payload: { error: { message: `沒有準備 ${path} 的回應` } } };
  };
}

const ok = (payload) => ({ ok: true, status: 200, payload });
const bad = (status, error) => ({ ok: false, status, payload: { error } });

test('本來就是粉專權杖時原樣使用,不去換', async () => {
  resetTokenCache();
  const r = await resolvePageToken('PAGE_TOKEN', PAGE_ID, {
    fetchImpl: fakeGraph({ 'me?fields=id,name': ok({ id: PAGE_ID, name: 'CSO 絕對武力粉絲團' }) })
  });
  assert.equal(r.kind, 'page');
  assert.equal(r.token, 'PAGE_TOKEN');
});

test('用戶權杖會自動換成該粉專的權杖', async () => {
  resetTokenCache();
  const r = await resolvePageToken('USER_TOKEN', PAGE_ID, {
    fetchImpl: fakeGraph({
      'me?fields=id,name': ok({ id: '28875020115528065', name: 'Lesley Liao' }),
      'me/accounts': ok({ data: [
        { id: '999', name: '別的粉專', access_token: 'OTHER' },
        { id: PAGE_ID, name: 'CSO 絕對武力粉絲團', access_token: 'PAGE_TOKEN_FROM_EXCHANGE' }
      ] })
    })
  });
  assert.equal(r.kind, 'exchanged');
  assert.equal(r.token, 'PAGE_TOKEN_FROM_EXCHANGE');
});

test('用戶權杖但管不到這個粉專時,錯誤訊息要列出他能管哪些', async () => {
  resetTokenCache();
  await assert.rejects(
    () => resolvePageToken('USER_TOKEN', PAGE_ID, {
      fetchImpl: fakeGraph({
        'me?fields=id,name': ok({ id: '123', name: 'Lesley Liao' }),
        'me/accounts': ok({ data: [{ id: '999', name: '別的粉專', access_token: 'OTHER' }] })
      })
    }),
    (e) => {
      assert.match(e.message, /找不到編號 284455941624148/);
      assert.match(e.message, /別的粉專\(999\)/);
      return true;
    }
  );
});

test('用戶權杖且一個粉專都管不到,要明講「一個都沒有」', async () => {
  resetTokenCache();
  await assert.rejects(
    () => resolvePageToken('USER_TOKEN', PAGE_ID, {
      fetchImpl: fakeGraph({
        'me?fields=id,name': ok({ id: '123', name: 'Lesley Liao' }),
        'me/accounts': ok({ data: [] })
      })
    }),
    /一個都沒有/
  );
});

test('缺 pages_show_list 導致換不到時,訊息要指出該怎麼辦', async () => {
  resetTokenCache();
  await assert.rejects(
    () => resolvePageToken('USER_TOKEN', PAGE_ID, {
      fetchImpl: fakeGraph({
        'me?fields=id,name': ok({ id: '123', name: 'Lesley Liao' }),
        'me/accounts': bad(403, { code: 200, message: 'Missing permission' })
      })
    }),
    /pages_show_list/
  );
});

test('權杖過期要回可辨識的訊息', async () => {
  resetTokenCache();
  await assert.rejects(
    () => resolvePageToken('DEAD', PAGE_ID, {
      fetchImpl: fakeGraph({ 'me?fields=id,name': bad(401, { code: 190, message: 'expired' }) })
    }),
    /權杖已失效或過期/
  );
});

test('缺環境變數時立刻拒絕,不去打 Graph', async () => {
  resetTokenCache();
  await assert.rejects(() => resolvePageToken('', PAGE_ID), /缺少 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN/);
  await assert.rejects(() => resolvePageToken('TOKEN', ''), /缺少 FB_PAGE_ID 或 FB_PAGE_ACCESS_TOKEN/);
});

test('同一組權杖第二次呼叫走快取,不重複打 Graph', async () => {
  resetTokenCache();
  let calls = 0;
  const counting = async (path) => {
    calls++;
    if (path.startsWith('me?fields=id,name')) return ok({ id: PAGE_ID, name: 'CSO' });
    return bad(404, { message: 'x' });
  };
  await resolvePageToken('SAME', PAGE_ID, { fetchImpl: counting });
  const first = calls;
  await resolvePageToken('SAME', PAGE_ID, { fetchImpl: counting });
  assert.equal(calls, first, '第二次應該完全不打 Graph');
});
