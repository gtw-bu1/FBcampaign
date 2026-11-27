import { resolvePageToken } from './_pagetoken.mjs';
import { claimPhotoJob, updateClaimedJob, validJobId } from './_photo-queue.mjs';
import { publishPhotoFeed } from './post-to-facebook.js';

const ticketFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const { id, ticket } = req.body || {};
  if (!validJobId(id) || typeof ticket !== 'string' || !ticketFormat.test(ticket)) return res.status(400).json({ ok: false });

  const pageId = process.env.FB_PAGE_ID;
  if (!pageId || !process.env.FB_PAGE_ACCESS_TOKEN) return res.status(503).json({ ok: false });
  try {
    const job = await claimPhotoJob(id, ticket, pageId);
    if (!job) return res.status(200).json({ accepted: false });

    let token;
    try {
      ({ token } = await resolvePageToken(process.env.FB_PAGE_ACCESS_TOKEN, pageId));
    } catch {
      // No publish request was attempted. A later callback may try again.
      await updateClaimedJob(id, { state: 'pending', next_attempt: new Date(Date.now() + 3 * 60000).toISOString() });
      return res.status(503).json({ ok: false });
    }

    let postId;
    try {
      const images = job.image_data.startsWith('[') ? JSON.parse(job.image_data) : [job.image_data];
      const result = await publishPhotoFeed(pageId, token, job.message, images);
      postId = result.post_id || result.id;
      if (!postId) throw new Error('Missing Facebook ID');
    } catch {
      // A timeout can follow a successful Facebook publish. Never replay the upload automatically.
      await updateClaimedJob(id, { state: 'review', image_data: null });
      return res.status(502).json({ ok: false });
    }
    await updateClaimedJob(id, { state: 'published', post_id: String(postId), image_data: null });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(503).json({ ok: false });
  }
}
