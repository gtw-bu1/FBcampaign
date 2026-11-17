// 排程發文的時間換算與前端驗證
//
// Facebook 規定 scheduled_publish_time 必須在送出後 10 分鐘 ~ 30 天之間。
// 後端 api/post-to-facebook.js 也會再檢一次,這裡只是讓使用者在按下去之前就看到問題。
export const MIN_AHEAD_SECONDS = 10 * 60;
export const MAX_AHEAD_SECONDS = 30 * 24 * 60 * 60;

// 把毫秒時間戳轉成 <input type="datetime-local"> 需要的本地時間字串(YYYY-MM-DDTHH:mm)。
// 不能用 toISOString(),那是 UTC,會差掉時區。
export function localInputValue(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// datetime-local 的值是「本地時間、沒有時區」,new Date() 會依瀏覽器時區解讀,正是我們要的。
export function toUnixSeconds(value) {
  if (typeof value !== 'string' || !value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

// 給 datetime-local 的 min / max,避免使用者選到不合法的時間。
// min 多留 1 分鐘緩衝:使用者填完表單還要按按鈕,剛好 10 分鐘的話送出時已經過期。
export function inputBounds(nowMs = Date.now()) {
  return {
    min: localInputValue(nowMs + (MIN_AHEAD_SECONDS + 60) * 1000),
    max: localInputValue(nowMs + MAX_AHEAD_SECONDS * 1000)
  };
}

// 預設帶入「30 分鐘後」,是個安全又好測的時間。
export function defaultInputValue(nowMs = Date.now()) {
  return localInputValue(nowMs + 30 * 60 * 1000);
}

// 回傳錯誤字串;沒問題回空字串。
export function validateScheduleInput(value, nowMs = Date.now()) {
  const seconds = toUnixSeconds(value);
  if (seconds === null) return '排程時間格式不正確,請重新選擇。';
  const now = Math.floor(nowMs / 1000);
  if (seconds < now + MIN_AHEAD_SECONDS) return '排程時間必須至少在 10 分鐘之後(Facebook 的規定)。';
  if (seconds > now + MAX_AHEAD_SECONDS) return '排程時間不能超過 30 天之後(Facebook 的規定)。';
  return '';
}
