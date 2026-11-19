import test from 'node:test';
import assert from 'node:assert/strict';
import { graphGetAll, readGraphError } from '../api/page-insights.js';

// 2026-11-19 的真實 bug:第一頁用 Authorization header 送權杖,
// Facebook 回的 paging.next 不含 access_token,
// 程式卻直接去打那個網址而沒帶 header → 第二頁回 (#200) Provide valid app ID。
// 這組測試把「每一頁都必須帶憑證」鎖住。

function fakeFetch(pages) {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url: String(url), auth: options?.headers?.Authorization || null });
    const i = calls.length - 1;
    const page = pages[i];
    if (!page) throw new Error(`沒有準備第 ${i + 1} 頁的回應`);
    return {
      ok: true,
      status: 200,
      json: async () => page
    };
  };
  return { impl, calls };
}

test('分頁時每一次請求都帶 Authorization,包含第二頁以後', async () => {
  const { impl, calls } = fakeFetch([
    { data: [{ id: 'a' }], paging: { next: 'https://graph.facebook.com/v27.0/next-page-no-token' } },
    { data: [{ id: 'b' }] }
  ]);
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    const r = await graphGetAll('123/published_posts?limit=100', 'TOKEN');
    assert.equal(r.data.length, 2);
    assert.equal(r.pages, 2);
    assert.equal(r.truncated, false);
    assert.equal(calls.length, 2);
    for (const [i, c] of calls.entries()) {
      assert.equal(c.auth, 'Bearer TOKEN', `第 ${i + 1} 次請求沒帶憑證`);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('沒有 next 時只打一次就停', async () => {
  const { impl, calls } = fakeFetch([{ data: [{ id: 'a' }] }]);
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    const r = await graphGetAll('123/published_posts', 'TOKEN');
    assert.equal(calls.length, 1);
    assert.equal(r.pages, 1);
    assert.equal(r.truncated, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('達到頁數上限時回報 truncated,不要假裝抓完了', async () => {
  const withNext = (id) => ({ data: [{ id }], paging: { next: 'https://graph.facebook.com/v27.0/more' } });
  const { impl } = fakeFetch([withNext('a'), withNext('b'), withNext('c')]);
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    const r = await graphGetAll('123/published_posts', 'TOKEN', { maxPages: 2 });
    assert.equal(r.pages, 2);
    assert.equal(r.truncated, true, '還有下一頁就要標記 truncated');
  } finally {
    globalThis.fetch = original;
  }
});

test('某一頁回空陣列就停,避免無限翻頁', async () => {
  const { impl, calls } = fakeFetch([
    { data: [{ id: 'a' }], paging: { next: 'https://graph.facebook.com/v27.0/p2' } },
    { data: [], paging: { next: 'https://graph.facebook.com/v27.0/p3' } }
  ]);
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    const r = await graphGetAll('123/published_posts', 'TOKEN');
    assert.equal(calls.length, 2);
    assert.equal(r.data.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});

test('「Provide valid app ID」要說這是程式問題,不可誤導成缺權限', () => {
  const msg = readGraphError({ error: { code: 200, message: '(#200) Provide valid app ID' } }, 400);
  assert.match(msg, /程式的錯誤/);
  assert.match(msg, /沒有帶上憑證/);
  assert.ok(!/pages_read_user_content/.test(msg), '不可叫使用者去要權限');
});

test('真正缺 pages_read_user_content 時仍要正確指出', () => {
  const msg = readGraphError({
    error: { code: 10, message: "requires the 'pages_read_user_content' permission" }
  }, 403);
  assert.match(msg, /pages_read_user_content/);
});
