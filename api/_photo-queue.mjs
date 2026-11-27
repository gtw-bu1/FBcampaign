import { createHash } from 'node:crypto';

export const queuePrefix = 'queue-';
export const validJobId = id => typeof id === 'string' && /^[0-9a-f]{64}$/.test(id);
export const queueConfigured = () => Boolean(process.env.FB_QUEUE_SUPABASE_URL && process.env.FB_QUEUE_SUPABASE_SECRET_KEY);

async function database(path, { method = 'GET', body, prefer } = {}) {
  if (!queueConfigured()) throw new Error('尚未設定工具排程資料庫。');
  const base = process.env.FB_QUEUE_SUPABASE_URL.replace(/\/$/, '');
  const response = await fetch(base + '/rest/v1/' + path, {
    method,
    headers: {
      apikey: process.env.FB_QUEUE_SUPABASE_SECRET_KEY,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'error',
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error('工具排程資料庫回應異常（HTTP ' + response.status + '）。');
  if (method === 'GET' || prefer?.includes('return=representation') || path.startsWith('rpc/')) {
    return response.json();
  }
}

export async function enqueuePhoto(pageId, message, images, at) {
  // Preserve the original single-image representation and its idempotency key.
  const imageDataUrl = images.length === 1 ? images[0] : JSON.stringify(images);
  const id = createHash('sha256').update(JSON.stringify([pageId, at, message, imageDataUrl])).digest('hex');
  const rows = await database('fb_photo_jobs?select=id,state', {
    method: 'POST',
    prefer: 'resolution=ignore-duplicates,return=representation',
    body: { id, page_id: pageId, due_at: new Date(at * 1000).toISOString(), message, image_data: imageDataUrl }
  });
  if (!rows.length) {
    const [existing] = await database('fb_photo_jobs?id=eq.' + id + '&select=state');
    if (existing?.state !== 'pending') throw new Error('這筆排程的狀態已變更，請重新查詢清單。');
  }
  return queuePrefix + id;
}

const columns = 'id,due_at,message,state,post_id';
export async function listPhotoJobs(pageId) {
  const base = 'fb_photo_jobs?page_id=eq.' + encodeURIComponent(pageId) + '&select=' + columns;
  const [active, recent] = await Promise.all([
    listActive(),
    database(base + '&state=eq.published&order=updated_at.desc&limit=10')
  ]);
  async function listActive() {
    const rows = [];
    for (;;) {
      const page = await database(base + '&state=neq.published&order=due_at,id&limit=100&offset=' + rows.length);
      rows.push(...page);
      if (page.length < 100) return rows;
    }
  }
  return [...active, ...recent];
}

export async function cancelPhotoJob(pageId, id) {
  if (!validJobId(id)) return false;
  const rows = await database('fb_photo_jobs?select=id&state=eq.pending&id=eq.' + id + '&page_id=eq.' + encodeURIComponent(pageId), {
    method: 'DELETE', prefer: 'return=representation'
  });
  return rows.length === 1;
}

export async function claimPhotoJob(id, ticket, pageId) {
  const rows = await database('rpc/fb_claim_photo', {
    method: 'POST', body: { job_id: id, job_ticket: ticket, target_page: pageId }
  });
  return rows[0];
}

export async function updateClaimedJob(id, values) {
  const result = await database('fb_photo_jobs?id=eq.' + id + '&state=eq.publishing&select=id', {
    method: 'PATCH', prefer: 'return=representation', body: { ...values, updated_at: new Date().toISOString() }
  });
  if (result.length !== 1) throw new Error('排程狀態已變更。');
}
