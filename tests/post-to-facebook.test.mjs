import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validatePublishRequest, scheduleWindow, decodeDataUrl, readGraphError, fallbackPermalink, fetchPermalink } from '../api/post-to-facebook.js';
import { resetTokenCache } from '../api/_pagetoken.mjs';

const NOW = 1_800_000_000;
const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

test('貼文內容必填', () => {
  assert.equal(validatePublishRequest({ message: '上線囉' }, NOW), '');
  assert.match(validatePublishRequest({ message: '' }, NOW), /不可為空/);
  assert.match(validatePublishRequest({ message: '   ' }, NOW), /不可為空/);
  assert.match(validatePublishRequest({}, NOW), /不可為空/);
  assert.match(validatePublishRequest(null, NOW), /格式不正確/);
});

test('貼文內容過長要擋', () => {
  assert.match(validatePublishRequest({ message: 'x'.repeat(20001) }, NOW), /過長/);
  assert.equal(validatePublishRequest({ message: 'x'.repeat(20000) }, NOW), '');
});

test('只接受 JPEG 與 PNG 的 data URL', () => {
  assert.equal(validatePublishRequest({ message: 'a', imageDataUrl: PNG }, NOW), '');
  assert.equal(validatePublishRequest({ message: 'a', imageDataUrl: JPG }, NOW), '');
  assert.match(validatePublishRequest({ message: 'a', imageDataUrl: 'data:image/gif;base64,AAA=' }, NOW), /圖片格式不正確/);
  assert.match(validatePublishRequest({ message: 'a', imageDataUrl: 'https://example.com/a.png' }, NOW), /圖片格式不正確/);
  assert.match(validatePublishRequest({ message: 'a', imageDataUrl: 'data:image/png;base64,有中文' }, NOW), /圖片格式不正確/);
});

test('圖片過大要擋', () => {
  const huge = 'data:image/jpeg;base64,' + 'A'.repeat(8_000_001);
  assert.match(validatePublishRequest({ message: 'a', imageDataUrl: huge }, NOW), /圖片過大/);
});

test('連結必須是 https', () => {
  assert.equal(validatePublishRequest({ message: 'a', link: 'https://cso.beanfun.com/' }, NOW), '');
  assert.match(validatePublishRequest({ message: 'a', link: 'http://cso.beanfun.com/' }, NOW), /https/);
  assert.match(validatePublishRequest({ message: 'a', link: 'javascript:alert(1)' }, NOW), /https/);
});

test('排程時間要落在 Facebook 規定的 10 分鐘到 30 天之間', () => {
  const { min, max } = scheduleWindow(NOW);
  assert.equal(min, NOW + 600);
  assert.equal(max, NOW + 2592000);
  assert.equal(validatePublishRequest({ message: 'a', scheduledPublishTime: min }, NOW), '');
  assert.equal(validatePublishRequest({ message: 'a', scheduledPublishTime: max }, NOW), '');
  assert.match(validatePublishRequest({ message: 'a', scheduledPublishTime: min - 1 }, NOW), /10 分鐘/);
  assert.match(validatePublishRequest({ message: 'a', scheduledPublishTime: max + 1 }, NOW), /30 天/);
  assert.match(validatePublishRequest({ message: 'a', scheduledPublishTime: NOW }, NOW), /10 分鐘/);
  assert.match(validatePublishRequest({ message: 'a', scheduledPublishTime: 1.5 }, NOW), /整數/);
  assert.match(validatePublishRequest({ message: 'a', scheduledPublishTime: '123' }, NOW), /整數/);
});

test('data URL 解得出 MIME、位元組與副檔名', () => {
  const png = decodeDataUrl(PNG);
  assert.equal(png.mime, 'image/png');
  assert.equal(png.ext, 'png');
  assert.ok(png.bytes.length > 0);
  // PNG 檔頭魔術位元組
  assert.deepEqual([...png.bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);

  const jpg = decodeDataUrl(JPG);
  assert.equal(jpg.mime, 'image/jpeg');
  assert.equal(jpg.ext, 'jpg');
  assert.deepEqual([...jpg.bytes.subarray(0, 2)], [0xff, 0xd8]);

  assert.equal(decodeDataUrl('data:image/gif;base64,AAA='), null);
  assert.equal(decodeDataUrl(''), null);
  assert.equal(decodeDataUrl(undefined), null);
});

test('Graph API 的錯誤要翻成看得懂的話', () => {
  assert.match(readGraphError({ error: { code: 190, message: 'Invalid OAuth token' } }, 400), /權杖已失效或過期/);
  assert.match(readGraphError({ error: { code: 200, message: 'Permissions error' } }, 403), /權限不足/);
  assert.match(readGraphError({ error: { code: 10, message: 'Permission denied' } }, 403), /權限不足/);
  assert.match(readGraphError({ error: { code: 368, message: 'Temporarily blocked' } }, 400), /限制發文/);
  assert.match(readGraphError({ error: { code: 1, message: 'Unknown' } }, 500), /拒絕這次發布/);
  assert.match(readGraphError(null, 500), /回應異常.*500/);
  // error_user_msg 有的話也要帶出來
  assert.match(readGraphError({ error: { code: 1, message: 'a', error_user_msg: '請稍後再試' } }, 500), /請稍後再試/);
});

// 2026-11-25 真實事故:發布成功卻回了 facebook.com/284455941624148_1579963497501291,
// 那不是 Facebook 認得的路徑,點進去看不到貼文,使用者以為沒發布又按一次 → 粉專重複貼文。
// Graph 實際給的 permalink_url 是 facebook.com/1572421051588869/posts/1579963497501291。
test('貼文網址不能用 <粉專編號>_<貼文編號> 的格式', () => {
  const url = fallbackPermalink('284455941624148', '284455941624148_1579963497501291');
  assert.equal(url, 'https://www.facebook.com/284455941624148/posts/1579963497501291');
  assert.ok(!url.includes('_'), '網址裡不可以出現底線那種合成編號:' + url);
  // 沒有底線的裸編號也要能處理
  assert.equal(fallbackPermalink('123', '456'), 'https://www.facebook.com/123/posts/456');
  assert.equal(fallbackPermalink('123', ''), '');
  assert.equal(fallbackPermalink('123', undefined), '');
});

test('permalink 以 Graph 回的 permalink_url 為準,拿不到就回空字串不要編', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ permalink_url: 'https://www.facebook.com/1572421051588869/posts/1579963497501291' }) });
    assert.equal(await fetchPermalink('284455941624148_1579963497501291', 't'),
      'https://www.facebook.com/1572421051588869/posts/1579963497501291');

    // 非 facebook.com 的網址不信
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ permalink_url: 'https://evil.example/x' }) });
    assert.equal(await fetchPermalink('1_2', 't'), '');

    // Graph 回錯或沒有這個欄位時回空字串,不可以自己拼一個
    globalThis.fetch = async () => ({ ok: false, json: async () => ({ error: { code: 100 } }) });
    assert.equal(await fetchPermalink('1_2', 't'), '');
    globalThis.fetch = async () => { throw new Error('network down'); };
    assert.equal(await fetchPermalink('1_2', 't'), '');
    assert.equal(await fetchPermalink('', 't'), '');
  } finally {
    globalThis.fetch = oldFetch;
  }
});


// 這裡檢查送給 Graph 的請求；到點後的訪客畫面需另外驗收。
test('單圖排程先上傳 temporary 照片，再用 SCHEDULED 貼文附上原圖及文案', async () => {
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
  const pageId = '284455941624148';
  const oldEnv = { id: process.env.FB_PAGE_ID, tk: process.env.FB_PAGE_ACCESS_TOKEN, code: process.env.FB_CAMPAIGN_ACCESS_CODE };
  const oldFetch = globalThis.fetch;
  process.env.FB_PAGE_ID = pageId;
  process.env.FB_PAGE_ACCESS_TOKEN = 'page-token-for-test';
  process.env.FB_CAMPAIGN_ACCESS_CODE = 'test-access-code-at-least-24-chars';
  resetTokenCache();

  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url);
    calls.push({ url: u, options });
    if (u.includes('me?fields=id,name')) return { ok: true, status: 200, json: async () => ({ id: pageId, name: '測試粉專' }) };
    if (u.includes('/photos')) return { ok: true, status: 200, json: async () => ({ id: 'PHOTO_1' }) };
    if (u.includes('/feed')) return { ok: true, status: 200, json: async () => ({ id: pageId + '_STORY_9' }) };
    return { ok: false, status: 404, json: async () => ({ error: { message: 'unexpected ' + u } }) };
  };

  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; } };
  try {
    const scheduledTime = Math.floor(Date.now() / 1000) + 3600;
    await handler({
      method: 'POST',
      headers: { 'x-access-code': process.env.FB_CAMPAIGN_ACCESS_CODE },
      body: { message: '【測試】排程文案', imageDataUrl: PNG, scheduledPublishTime: scheduledTime }
    }, res);

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.scheduled, true);
    assert.equal(res.body.postId, pageId + '_STORY_9');
    assert.equal(res.body.permalink, '', '排程貼文還沒公開,不該給網址');

    const photoCall = calls.find((c) => c.url.includes('/photos'));
    const feedCall = calls.find((c) => c.url.includes('/feed'));
    assert.ok(photoCall, '要先上傳照片');
    assert.ok(feedCall, '要再用 /feed 排程');
    assert.deepEqual(calls.filter(c => c.options.method === 'POST'), [photoCall, feedCall]);

    // 照片那一步:published=false,而且**不可以**帶 scheduled_publish_time
    const fields = [...photoCall.options.body.keys()];
    assert.equal(photoCall.options.body.get('published'), 'false');
    assert.equal(photoCall.options.body.get('temporary'), 'true');
    assert.deepEqual(Buffer.from(await photoCall.options.body.get('source').arrayBuffer()), decodeDataUrl(PNG).bytes);
    assert.ok(!fields.includes('scheduled_publish_time'), '照片那一步不可以帶排程時間:' + fields.join(','));
    assert.ok(!fields.includes('caption'), '文字要寫在 /feed 的 message,不是照片的 caption');

    // /feed 那一步:帶 attached_media 指向剛上傳的照片
    const sent = JSON.parse(feedCall.options.body);
    assert.deepEqual(sent.attached_media, [{ media_fbid: 'PHOTO_1' }]);
    assert.equal(sent.published, false);
    assert.equal(sent.message, '【測試】排程文案');
    assert.equal(sent.unpublished_content_type, 'SCHEDULED');
    assert.equal(sent.scheduled_publish_time, scheduledTime);
  } finally {
    globalThis.fetch = oldFetch;
    resetTokenCache();
    if (oldEnv.id === undefined) delete process.env.FB_PAGE_ID; else process.env.FB_PAGE_ID = oldEnv.id;
    if (oldEnv.tk === undefined) delete process.env.FB_PAGE_ACCESS_TOKEN; else process.env.FB_PAGE_ACCESS_TOKEN = oldEnv.tk;
    if (oldEnv.code === undefined) delete process.env.FB_CAMPAIGN_ACCESS_CODE; else process.env.FB_CAMPAIGN_ACCESS_CODE = oldEnv.code;
  }
});

function mockPhotoApi(t, onRequest) {
  const env = { FB_PAGE_ID: '55555', FB_PAGE_ACCESS_TOKEN: 'fixture', FB_CAMPAIGN_ACCESS_CODE: 'offline-test'.repeat(3) };
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  resetTokenCache();
  t.after(resetTokenCache);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/me')) return Response.json({ id: '55555' });
    calls.push({ path: url.pathname, options });
    return onRequest(url.pathname, options);
  });
  return calls;
}

async function submitPhoto(body) {
  const res = { setHeader() {}, status(n) { this.code = n; return this; }, json(v) { this.data = v; return this; } };
  await handler({ method:'POST', headers:{'x-access-code': process.env.FB_CAMPAIGN_ACCESS_CODE}, body: {message:'活動文案', ...body} }, res);
  return res;
}

for (const images of [[PNG], [JPG, PNG]]) {
  test('立刻發布 ' + images.length + ' 張圖，只在最後的 /feed 公開文案和依序排列的附件', async t => {
    let uploaded = 0;
    const calls = mockPhotoApi(t, (path, { body }) => {
      if (path.endsWith('/photos')) return Response.json({ id: 'photo' + ++uploaded });
      if (path.endsWith('/feed')) return Response.json({ id: '55555_99999' });
      return Response.json({ permalink_url: 'https://www.facebook.com/55555/posts/99999' });
    });
    const result = await submitPhoto(images.length === 1 ? { imageDataUrl: PNG } : { imageDataUrls: images });
    assert.equal(result.code, 200);
    assert.equal(result.data.postId, '55555_99999');
    assert.equal(result.data.permalink, 'https://www.facebook.com/55555/posts/99999');
    assert.deepEqual(calls.map(c=>c.path), [
      ...images.map(()=>'/v27.0/55555/photos'), '/v27.0/55555/feed', '/v27.0/55555_99999'
    ]);
    for (const [index, image] of images.entries()) {
      const form = calls[index].options.body;
      assert.deepEqual([...form.keys()].sort(), ['published','source']);
      assert.equal(form.get('published'), 'false');
      assert.deepEqual(Buffer.from(await form.get('source').arrayBuffer()), decodeDataUrl(image).bytes);
    }
    assert.deepEqual(JSON.parse(calls[images.length].options.body), {
      message:'活動文案', attached_media: images.map((_,i)=>({media_fbid:'photo'+(i+1)}))
    });
  });
}

test('第二張圖上傳失敗就停止，不能發布一篇缺圖的貼文', async t => {
  const calls = mockPhotoApi(t, () => calls.length === 1 ? Response.json({id:'p1'}) : Response.json({error:{message:'bad image'}},{status:400}));
  assert.equal((await submitPhoto({imageDataUrls:[PNG,JPG]})).code,502);
  assert.deepEqual(calls.map(c=>c.path), ['/v27.0/55555/photos','/v27.0/55555/photos']);
});

test('缺少貼文編號時，不把照片編號當成已發布的貼文', async t => {
  mockPhotoApi(t, path => Response.json(path.endsWith('/photos') ? {id:'p1'} : {}));
  const result = await submitPhoto({imageDataUrl:PNG});
  assert.equal(result.code,502);
  assert.match(result.data.error,/貼文編號/);
});

test('所有圖片須在第一個上傳前通過驗證', () => {
  for (const fields of [{imageDataUrls:[]},{imageDataUrls:PNG},{imageDataUrls:[PNG,'bad']},{imageDataUrls:Array(11).fill(PNG)},{imageDataUrl:PNG,imageDataUrls:[JPG]}]) {
    assert.ok(validatePublishRequest({message:'test',...fields}, NOW));
  }
});
