import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublishRequest, scheduleWindow, decodeDataUrl, readGraphError } from '../api/post-to-facebook.js';

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
