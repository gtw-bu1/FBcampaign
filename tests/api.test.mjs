import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { composeCopy, validateRequest } from '../api/generate.js';
import { initial, defaultStyle } from '../src/core.mjs';

const body = { activity: initial, style: defaultStyle, size: '1200x1200' };
function response() {
  return { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; } };
}

test('request accepts supported content and rejects unknown size', () => {
  assert.equal(validateRequest(body), '');
  assert.match(validateRequest({ ...body, size: '4000x4000' }), /尺寸/);
});

test('AI hook cannot replace exact activity facts', () => {
  const copy = composeCopy(initial, defaultStyle, '一起展開新的冒險！');
  for (const key of ['time', 'rewards', 'conditions', 'cta']) assert.ok(copy.includes(initial[key]));
});

test('API refuses requests before a server key is configured', async () => {
  const oldKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result = response();
    await handler({ method: 'POST', headers: {}, body }, result);
    assert.equal(result.statusCode, 503);
    assert.match(result.body.error, /尚未啟用/);
  } finally { if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey; }
});

test('server authenticates and sends text only to image generation', async () => {
  const oldKey = process.env.OPENAI_API_KEY, oldCode = process.env.FB_CAMPAIGN_ACCESS_CODE, oldFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.FB_CAMPAIGN_ACCESS_CODE = 'test-access-code-at-least-24-chars';
  const sent = [];
  globalThis.fetch = async (url, options) => {
    sent.push({ url, body: JSON.parse(options.body) });
    const payload = url.endsWith('/responses')
      ? { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ hook: '好禮等你拿！', visual_direction: '柔和暖橘光影' }) }] }] }
      : { data: [{ b64_json: 'AQID' }] };
    return { ok: true, json: async () => payload };
  };
  try {
    const denied = response();
    await handler({ method: 'POST', headers: { 'x-access-code': 'wrong' }, body }, denied);
    assert.equal(denied.statusCode, 401);
    assert.equal(sent.length, 0);
    const accepted = response();
    await handler({ method: 'POST', headers: { 'x-access-code': process.env.FB_CAMPAIGN_ACCESS_CODE }, body: { ...body, assets: ['PRIVATE_ORIGINAL_ASSET'] } }, accepted);
    assert.equal(accepted.statusCode, 200);
    assert.equal(accepted.body.mode, 'live');
    assert.ok(accepted.body.backgroundDataUrl.startsWith('data:image/jpeg;base64,'));
    assert.equal(sent.length, 2);
    assert.ok(!JSON.stringify(sent).includes('PRIVATE_ORIGINAL_ASSET'));
    assert.equal(sent[1].body.size, '1024x1024');
    assert.ok(accepted.body.copy.includes(initial.conditions));
    const wide = response();
    await handler({ method: 'POST', headers: { 'x-access-code': process.env.FB_CAMPAIGN_ACCESS_CODE }, body: { ...body, size: '1200x628' } }, wide);
    assert.equal(wide.statusCode, 200);
    assert.equal(sent[3].body.size, '1536x800');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldCode === undefined) delete process.env.FB_CAMPAIGN_ACCESS_CODE; else process.env.FB_CAMPAIGN_ACCESS_CODE = oldCode;
  }
});
