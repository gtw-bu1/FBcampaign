// 與 api/generate.js 相同的使用密碼驗證(含記住裝置的簽章 cookie)。
// 刻意獨立成一支,新端點共用同一道門,不去改動已在運作的 generate.js。
// 注意:SESSION_COOKIE、SESSION_SECONDS、簽章字串都必須和 generate.js 完全一致,
// 否則兩邊的「記住這台裝置」會互不認得。
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'fb_campaign_session';
export const SESSION_SECONDS = 30 * 24 * 60 * 60;

export function safeCodeMatches(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || expected.length < 24) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function sessionSignature(expires, secret) {
  return createHmac('sha256', secret).update(`fb-campaign:${expires}`).digest('base64url');
}

export function rememberedSession(req, secret) {
  if (!secret || secret.length < 24) return false;
  const value = String(req.headers?.cookie || '').split(';').map(x => x.trim())
    .find(x => x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const match = /^(\d{10,13})\.([A-Za-z0-9_-]{43})$/.exec(value || '');
  if (!match || Number(match[1]) <= Math.floor(Date.now() / 1000)) return false;
  const provided = Buffer.from(match[2]), expected = Buffer.from(sessionSignature(match[1], secret));
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// 這道門擋下來就回 401,通過回空字串
export function gate(req, secret) {
  if (!secret || secret.length < 24) return '尚未設定 FB_CAMPAIGN_ACCESS_CODE(至少 24 字元)。';
  if (safeCodeMatches(req.headers?.['x-access-code'], secret)) return '';
  if (rememberedSession(req, secret)) return '';
  return '使用密碼不正確，請重新輸入。';
}
