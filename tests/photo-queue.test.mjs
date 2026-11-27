import test from 'node:test';
import assert from 'node:assert/strict';
import publish from '../api/post-to-facebook.js';
import deliver from '../api/deliver-scheduled-photo.js';
import scheduled from '../api/scheduled-posts.js';
import { resetTokenCache } from '../api/_pagetoken.mjs';

const page = '55555';
const ticket = '11111111-1111-4111-8111-111111111111';
const image = 'data:image/png;base64,iVBORw0KGgo=';
const caption = '圖文排程測試';
const due = Math.floor(Date.now() / 1000) + 1800;

function setup(t, mock) {
  const env = {
    FB_PAGE_ID: page, FB_PAGE_ACCESS_TOKEN: 'offline-test',
    FB_CAMPAIGN_ACCESS_CODE: 'offline-test'.repeat(3),
    FB_QUEUE_SUPABASE_URL: 'https://queue.invalid', FB_QUEUE_SUPABASE_SECRET_KEY: 'offline-db'
  };
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  resetTokenCache();
  t.after(resetTokenCache);
  t.mock.method(globalThis, 'fetch', mock);
}
function json(payload, status = 200) {
  return Response.json(payload, { status });
}
async function invoke(handler, body, method = 'POST', query = {}) {
  const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method, body, query, headers: { 'x-access-code': process.env.FB_CAMPAIGN_ACCESS_CODE } }, res);
  return res;
}

test('accepted image schedule saves one job without contacting Facebook; delivery uses the immediate multipart path once', async t => {
  let row, sentForm, uploads = 0, graphCalls = 0;
  setup(t, async (input, options = {}) => {
    const url = new URL(input);
    if (url.hostname === 'graph.facebook.com') {
      graphCalls++;
      if (url.pathname.endsWith('/me')) return json({ id: page });
      assert.equal(url.pathname, '/v27.0/' + page + '/photos');
      sentForm = options.body;
      uploads++;
      return json({ id: 'photo', post_id: '55555_22222' });
    }
    assert.equal(url.hostname, 'queue.invalid');
    if (url.pathname.endsWith('/fb_claim_photo')) {
      const { job_ticket, target_page } = JSON.parse(options.body);
      if (row.state !== 'pending' || job_ticket !== ticket || target_page !== page) return json([]);
      row.state = 'publishing';
      return json([{ image_data: row.image_data, message: row.message }]);
    }
    if (options.method === 'PATCH') {
      assert.equal(url.searchParams.get('state'), 'eq.publishing');
      Object.assign(row, JSON.parse(options.body));
      return json([{ id: row.id }]);
    }
    if (options.method === 'GET') return json([{ state: row.state }]);
    assert.equal(options.method, 'POST');
    const proposed = JSON.parse(options.body);
    if (row) { assert.equal(proposed.id, row.id); return json([]); }
    row = { ...proposed, state: 'pending' };
    return json([{ id: row.id, state: row.state }]);
  });
  const body = { message: caption, imageDataUrl: image, scheduledPublishTime: due };
  const first = await invoke(publish, body);
  assert.equal(first.code, 200);
  assert.equal(first.data.jobId, 'queue-' + row.id);
  assert.equal((await invoke(publish, body)).data.jobId, first.data.jobId);
  assert.equal(graphCalls, 0);
  assert.equal(row.due_at, new Date(due * 1000).toISOString());
  assert.equal(row.image_data, image);
  assert.equal((await invoke(deliver, { id: row.id, ticket })).data.ok, true);
  assert.deepEqual([...sentForm.keys()].sort(), ['caption','source']);
  assert.equal(sentForm.get('caption'), caption);
  assert.equal(sentForm.get('source').type, 'image/png');
  assert.deepEqual(Buffer.from(await sentForm.get('source').arrayBuffer()), Buffer.from(image.split(',')[1], 'base64'));
  assert.equal(row.state, 'published');
  assert.equal(row.post_id, '55555_22222');
  assert.equal(row.image_data, null);
  assert.equal((await invoke(deliver, { id: row.id, ticket })).data.accepted, false);
  assert.equal(uploads, 1);
});

test('ambiguous Facebook response stops automatic replay', async t => {
  let state = 'pending', attempts = 0;
  setup(t, async (input, options) => {
    const path = new URL(input).pathname;
    if (path.endsWith('/fb_claim_photo')) {
      if (state !== 'pending') return json([]);
      state = 'publishing';
      return json([{ message: caption, image_data: image }]);
    }
    if (path.endsWith('/me')) return json({ id: page });
    if (path.endsWith('/photos')) { attempts++; throw new Error('connection lost'); }
    assert.equal(options.method, 'PATCH');
    state = JSON.parse(options.body).state;
    return json([{ id: 'x' }]);
  });
  const body = { id: 'a'.repeat(64), ticket };
  assert.equal((await invoke(deliver, body)).code, 502);
  assert.equal(state, 'review');
  await invoke(deliver, body);
  assert.equal(attempts, 1);
});

test('an unconfigured installation never falls back to native photo scheduling', async t => {
  setup(t, () => assert.fail('unexpected network request'));
  delete process.env.FB_QUEUE_SUPABASE_SECRET_KEY;
  assert.equal((await invoke(publish, { message: caption, imageDataUrl: image, scheduledPublishTime: due })).code, 503);
});

test('cancel only accepts local pending jobs and remains separate from native Facebook IDs', async t => {
  let exists = true;
  setup(t, async (input, options) => {
    const url = new URL(input);
    assert.equal(url.hostname, 'queue.invalid');
    assert.equal(url.searchParams.get('page_id'), 'eq.' + page);
    assert.equal(url.searchParams.get('state'), 'eq.pending');
    assert.equal(options.method, 'DELETE');
    const result = exists ? [{ id: 'x' }] : [];
    exists = false;
    return json(result);
  });
  const query = { id: 'queue-' + 'a'.repeat(64) };
  assert.equal((await invoke(scheduled, {}, 'DELETE', query)).code, 200);
  assert.equal((await invoke(scheduled, {}, 'DELETE', query)).code, 409);
});

test('local jobs stay visible even when Facebook cannot return its legacy queue', async t => {
  setup(t, async (input) => {
    const url = new URL(input);
    if (url.hostname === 'graph.facebook.com') return json({error:{message:'offline'}}, 503);
    if (url.searchParams.get('state') === 'eq.published') return json([]);
    return json([{ id: 'b'.repeat(64), due_at: new Date(due * 1000).toISOString(), message: caption, state: 'pending', post_id: null }]);
  });
  const res = await invoke(scheduled, {}, 'GET');
  assert.equal(res.code, 200);
  assert.equal(res.data.posts[0].source, 'tool');
  assert.equal(res.data.posts[0].state, 'pending');
  assert.match(res.data.warning, /Facebook/);
  delete process.env.FB_QUEUE_SUPABASE_SECRET_KEY;
  assert.equal((await invoke(scheduled, {}, 'GET')).code, 502);
});

test('a token lookup failure before the photo is sent can be retried safely', async t => {
  let transition;
  setup(t, async (input, options) => {
    const path = new URL(input).pathname;
    if (path.endsWith('/fb_claim_photo')) return json([{message:caption,image_data:image}]);
    if (path.endsWith('/me')) return json({error:{code:190}}, 400);
    assert.equal(options.method, 'PATCH');
    transition = JSON.parse(options.body);
    return json([{ id: 'x' }]);
  });
  const res = await invoke(deliver, { id: 'a'.repeat(64), ticket });
  assert.equal(res.code, 503);
  assert.equal(transition.state, 'pending');
  assert.ok(Date.parse(transition.next_attempt) > Date.now());
  assert.equal(transition.image_data, undefined);
});
