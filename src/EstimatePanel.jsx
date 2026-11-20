// 活動成效預估面板。
//
// 2026-11-20 使用者要求:「預計發布日就等於活動開始日,這是你文案就可以抓到的,
// 你可以預設,但保留讓我改的空間」「活動獎勵 / 規模(抽/送) / 參與難度 等
// 你一樣都先預設,用目前有的資料去抓,或是讓我新增/調整」。
//
// 所以:**文案一貼上,所有欄位就自動填好**,不用按任何按鈕;
// 她改過的欄位會被記住(存在 overrides),文案再動也不會被蓋掉;
// 按「重新判讀文案」才會把手動值清掉、全部回到自動判讀。
import React, { useMemo, useState, useEffect } from 'react';
import {
  detectDraft, estimate, durationDays,
  BASELINE, DIFFICULTY_LIST, DELIVERY_LIST
} from './estimate.mjs';
import { REWARD_CATEGORIES, BUILTIN_ALIASES } from './reward-aliases.mjs';
import { browserStorage } from './saved-style.mjs';
import './performance.css';

// 一鍵更新後的基準表與品類對照存在瀏覽器裡。
// Vercel 的檔案系統唯讀,存不回專案;這個工具是單人用的,存瀏覽器最簡單也夠用。
const BASE_KEY = 'fb_campaign_baseline_v1';
const ALIAS_KEY = 'fb_campaign_aliases_v1';
// 2026-11-20 使用者:「規模跟難度希望會有新增(未來可能有新的方式)」。
// 新增的選項存瀏覽器,下次打開還在。
const WAYS_KEY = 'fb_campaign_custom_ways_v1';
const ADD_SENTINEL = '__add__';

function readStored(key) {
  try {
    const raw = browserStorage()?.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeStored(key, value) {
  try { browserStorage()?.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => new Intl.NumberFormat('zh-TW').format(v);

function itemOptions(base) {
  return base.items
    .slice()
    .sort((a, b) => b.posts - a.posts || b.score - a.score)
    .map((i) => ({
      key: i.item + '｜' + i.qty,
      label: `${i.item}${i.qty ? ' ×' + i.qty : ''}（${i.posts} 則・魅力度 ${i.score}${i.grade === '樣本不足' ? '・樣本不足' : '・' + i.grade + ' 級'}）`
    }));
}

export default function EstimatePanel({ activity = {}, copy = '', embedded = false }) {
  // 預估的文字來源:優先用 AI 生成的文案,沒有就用左邊填的活動欄位拼起來
  const fallbackText = useMemo(() => [
    activity.name, activity.time, activity.rewards, activity.conditions
  ].filter(Boolean).join('\n'), [activity.name, activity.time, activity.rewards, activity.conditions]);

  const [text, setText] = useState(copy || fallbackText);
  const [touchedText, setTouchedText] = useState(false);
  const [over, setOver] = useState({});        // 使用者手動改過的欄位
  const [season, setSeason] = useState(false);
  const [note, setNote] = useState('');

  const [base, setBase] = useState(() => readStored(BASE_KEY) || BASELINE);
  const [aliases, setAliases] = useState(() => readStored(ALIAS_KEY) || []);
  const [pendingPick, setPendingPick] = useState({});
  const [updating, setUpdating] = useState(false);
  const [accessCode, setAccessCode] = useState('');

  // 使用者自己新增的規模／難度選項
  const [custom, setCustom] = useState(() => {
    const s = readStored(WAYS_KEY);
    return { delivery: s?.delivery || [], difficulty: s?.difficulty || [] };
  });
  const [adding, setAdding] = useState('');   // 'delivery' | 'difficulty' | ''
  const [newWay, setNewWay] = useState('');

  const deliveryOptions = useMemo(
    () => [...DELIVERY_LIST, ...custom.delivery.filter((x) => !DELIVERY_LIST.includes(x))],
    [custom.delivery]);
  const difficultyOptions = useMemo(
    () => [...DIFFICULTY_LIST, ...custom.difficulty.filter((x) => !DIFFICULTY_LIST.includes(x))],
    [custom.difficulty]);

  function commitNewWay() {
    const kind = adding;
    const value = newWay.trim().slice(0, 20);
    if (!kind) return;
    if (!value) { setAdding(''); setNewWay(''); return; }
    const builtin = kind === 'delivery' ? DELIVERY_LIST : DIFFICULTY_LIST;
    const next = { ...custom };
    if (!builtin.includes(value) && !next[kind].includes(value)) {
      next[kind] = [...next[kind], value];
      setCustom(next);
      writeStored(WAYS_KEY, next);
    }
    setOver((cur) => ({ ...cur, [kind]: value }));
    setAdding(''); setNewWay('');
  }

  function removeWay(kind, value) {
    const next = { ...custom, [kind]: custom[kind].filter((x) => x !== value) };
    setCustom(next);
    writeStored(WAYS_KEY, next);
    setOver((cur) => (cur[kind] === value ? { ...cur, [kind]: undefined } : cur));
  }

  const pickWay = (kind) => (event) => {
    const value = event.target.value;
    if (value === ADD_SENTINEL) { setAdding(kind); setNewWay(''); return; }
    set(kind, value);
  };

  const ITEM_OPTIONS = useMemo(() => itemOptions(base), [base]);
  const isUpdated = base !== BASELINE && base.generatedAt !== BASELINE.generatedAt;

  useEffect(() => {
    if (touchedText) return;
    setText(copy || fallbackText);
  }, [copy, fallbackText, touchedText]);

  // 自動判讀:文案或基準表一變就重算
  const auto = useMemo(() => detectDraft(text, { base }), [text, base]);

  // 自動值 + 手動覆寫。使用者改過的欄位優先
  const view = useMemo(() => {
    const start = over.start ?? auto.start;
    const end = over.end ?? auto.end;
    return {
      // 「預計發布日 = 活動開始日」,抓不到就用今天
      publishDate: over.publishDate ?? (start || today()),
      start, end,
      difficulty: over.difficulty ?? auto.difficulty,
      delivery: over.delivery ?? auto.delivery,
      rewards: over.rewards ?? auto.rewards.map((r) => ({
        raw: r.raw,
        key: r.matchedItem ? r.matchedItem + '｜' + r.matchedQty : ''
      }))
    };
  }, [auto, over]);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    const detected = {
      rewards: view.rewards.map((r) => {
        const item = base.items.find((i) => i.item + '｜' + i.qty === r.key);
        return {
          raw: r.raw,
          matchedItem: item ? item.item : '',
          matchedQty: item ? String(item.qty) : '',
          grade: item ? item.grade : '',
          score: item ? item.score : null
        };
      }),
      difficulty: view.difficulty,
      delivery: view.delivery,
      start: view.start,
      end: view.end
    };
    const keys = view.rewards.map((r) => r.key).filter(Boolean);
    return estimate(detected, {
      publishDate: view.publishDate,
      useSeasonFactor: season,
      itemKeys: keys.length ? keys : null,
      base
    });
  }, [view, season, base, text]);

  const duration = durationDays(view.start, view.end);
  const set = (key, value) => setOver((cur) => ({ ...cur, [key]: value }));
  const setReward = (index, key) => setOver((cur) => ({
    ...cur, rewards: view.rewards.map((r, i) => (i === index ? { ...r, key } : r))
  }));
  const addReward = () => setOver((cur) => ({
    ...cur, rewards: [...view.rewards, { raw: '（手動加入）', key: '' }]
  }));
  const removeReward = (index) => setOver((cur) => ({
    ...cur, rewards: view.rewards.filter((_, i) => i !== index)
  }));

  // 一鍵更新:重新拉粉專貼文,重算基準表
  async function refreshBaseline(extraAliases = aliases) {
    setUpdating(true);
    setNote('正在重新讀取粉專貼文並重算基準,大約需要半分鐘…');
    try {
      const response = await fetch('/api/baseline', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(accessCode.trim() ? { 'x-access-code': accessCode.trim() } : {}) },
        body: JSON.stringify({ months: 24, aliases: extraAliases })
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw Error(json?.error || `更新失敗（${response.status}）。`);
      const next = json.baseline;
      setBase(next);
      setAliases(extraAliases);
      writeStored(BASE_KEY, next);
      writeStored(ALIAS_KEY, extraAliases);
      setAccessCode('');
      setPendingPick({});
      const pend = next.unclassified?.length || 0;
      setNote(`基準已更新:${next.activities.length} 則活動、${next.items.length} 種獎勵（掃過 ${next.scanned} 則貼文）。`
        + (next.excluded?.length ? `已排除 ${next.excluded.length} 則性質不同的活動。` : '')
        + (pend
          ? `還有 ${pend} 個獎勵沒分類——在指定完之前,同一款道具的不同季名稱會被當成不同獎勵,`
            + `樣本散掉、預估會比內建那份不準。請在下面指定品類,按一下就會重算。`
          : '所有獎勵都分類好了。'));
    } catch (error) {
      setNote(error?.message || '更新失敗,請重試。');
    } finally {
      setUpdating(false);
    }
  }

  function applyCategories() {
    const added = Object.entries(pendingPick)
      .filter(([, to]) => to && REWARD_CATEGORIES.includes(to))
      .map(([from, to]) => ({ from, to }));
    if (!added.length) { setNote('還沒指定任何品類。'); return; }
    const merged = [...aliases];
    for (const a of added) {
      const at = merged.findIndex((x) => x.from === a.from);
      if (at < 0) merged.push(a); else merged[at] = a;
    }
    refreshBaseline(merged);
  }

  function resetBaseline() {
    setBase(BASELINE);
    setAliases([]);
    writeStored(BASE_KEY, null);
    writeStored(ALIAS_KEY, null);
    setNote(`已回到工具內建的基準表（${BASELINE.generatedAt}）。`);
  }

  const changed = Object.keys(over).length > 0;

  return (
    <section className={embedded ? 'card performance-card embedded' : 'card performance-card'}>
      <div className="section-title">
        <span className="step">預</span><h2>活動成效預估</h2>
        <span className="required">依 {base.activities.length} 則真實活動・非 AI 猜測</span>
      </div>
      <p className="muted">
        參考這個粉專過去 {base.activities.length} 則活動貼文的實際留言數,
        加上獎勵魅力度與參與方式來估。每個數字都看得到是參考哪幾則算出來的。
      </p>

      <div className="baseline-bar">
        <div>
          <strong>基準資料</strong>
          <small>
            {isUpdated ? '已更新至 ' : '工具內建 '}{base.generatedAt}・
            {base.activities.length} 則活動・{base.items.length} 種獎勵
            {aliases.length > 0 && `・你補了 ${aliases.length} 筆品類對照`}
          </small>
        </div>
        <div className="baseline-actions">
          <button className="secondary" disabled={updating} onClick={() => refreshBaseline()}>
            {updating ? '更新中…' : '↻ 更新基準資料'}
          </button>
          {isUpdated && <button className="secondary" disabled={updating} onClick={resetBaseline}>回到內建</button>}
        </div>
      </div>
      <p className="muted baseline-hint">
        按「更新基準資料」會重新讀粉專最近 24 個月的貼文、重算每種獎勵的魅力度與各參與方式的表現,
        結果存在這台瀏覽器。新發的活動辦完之後按一下就會納入。
      </p>
      {!isUpdated && (
        <label className="field">使用密碼（第一次更新才需要）
          <input type="password" autoComplete="off" value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)} placeholder="跟發布貼文用的是同一組" />
        </label>
      )}

      {base.unclassified?.length > 0 && (
        <div className="pending-box">
          <strong>有 {base.unclassified.length} 個獎勵需要你指定品類</strong>
          <p className="muted">
            每季會換的道具(王牌角色、超越武器、噴漆…)名稱每次都不同。
            不歸類的話每一個都只有一則樣本,永遠累積不出魅力度。
            這些名稱對應到哪個品類只有你知道,我不猜。指定完按下面的按鈕,之後就會記住。
          </p>
          {base.unclassified.map((u) => (
            <div className="judge-row" key={u.name}>
              <span className="judge-raw" title={u.name}>{u.name}</span>
              <small className="pending-count">{u.count} 則・{u.dates[0]}</small>
              <select value={pendingPick[u.name] || ''}
                onChange={(e) => setPendingPick((cur) => ({ ...cur, [u.name]: e.target.value }))}>
                <option value="">（請選品類）</option>
                {REWARD_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          ))}
          <button className="generate" disabled={updating} onClick={applyCategories}>
            {updating ? '處理中…' : '記住這些品類並重算基準'} <span>→</span>
          </button>
        </div>
      )}

      <div className="performance-subtitle">① 進行預估</div>
      <label className="field">要預估的文案
        <textarea rows={6} value={text} maxLength={8000}
          onChange={(e) => { setText(e.target.value); setTouchedText(true); }}
          placeholder="貼上這次要發的活動文案,或先在左邊填活動內容、按 AI 生成文案" />
      </label>
      <p className="muted auto-hint">
        下面的欄位都是從文案自動抓的,直接改就會重新預估。
        {auto.dateFromText && <>　檔期來自文案這一行:<code>{auto.dateSource}</code></>}
        {!auto.dateFromText && text.trim() && <>　文案裡沒抓到「活動時間」那一行,檔期請自己填。</>}
        {changed && <>　<button className="link-btn" onClick={() => setOver({})}>↻ 重新判讀文案（清掉我改的）</button></>}
      </p>

      <div className="performance-grid">
        <label className="field">預計發布日
          <input type="date" value={view.publishDate} onChange={(e) => set('publishDate', e.target.value)} />
        </label>
        <label className="field">活動開始
          <input type="date" value={view.start} onChange={(e) => set('start', e.target.value)} />
        </label>
        <label className="field">活動結束
          <input type="date" value={view.end} onChange={(e) => set('end', e.target.value)} />
        </label>
        <label className="field">發放規模（抽／送）
          <select value={view.delivery} onChange={pickWay('delivery')}>
            {deliveryOptions.map((d) => <option key={d}>{d}</option>)}
            <option value={ADD_SENTINEL}>＋ 新增一種…</option>
          </select>
        </label>
        <label className="field">參與難度
          <select value={view.difficulty} onChange={pickWay('difficulty')}>
            {difficultyOptions.map((d) => <option key={d}>{d}</option>)}
            <option value={ADD_SENTINEL}>＋ 新增一種…</option>
          </select>
        </label>
      </div>
      {adding && (
        <div className="judge-row add-way">
          <span className="judge-raw">新增{adding === 'delivery' ? '發放規模' : '參與難度'}</span>
          <input autoFocus maxLength={20} value={newWay}
            placeholder={adding === 'delivery' ? '例如：留言+分享就送' : '例如：要錄影片投稿'}
            onChange={(e) => setNewWay(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitNewWay(); if (e.key === 'Escape') { setAdding(''); setNewWay(''); } }} />
          <button className="secondary" onClick={commitNewWay}>加入</button>
          <button className="icon-btn" aria-label="取消新增" onClick={() => { setAdding(''); setNewWay(''); }}>×</button>
        </div>
      )}
      {(custom.delivery.length > 0 || custom.difficulty.length > 0) && (
        <p className="muted">
          你新增的選項（存在這台瀏覽器，會一直留著）:
          {[...custom.delivery.map((v) => ['delivery', v]), ...custom.difficulty.map((v) => ['difficulty', v])]
            .map(([kind, v]) => (
              <button className="link-btn" key={kind + v} onClick={() => removeWay(kind, v)}>
                {v} ×
              </button>
            ))}
          　（按一下移除）
        </p>
      )}
      <p className="performance-duration">
        檔期長度:{duration === null ? '填了起迄日期才算得出來' : `${duration} 天（含頭尾）`}
        {(auto.dateSuspicious || (duration !== null && duration > 120))
          && '　⚠ 這個檔期長得不合理,我可能把年份判錯了（文案只寫月日時會這樣），請確認一下'}
        {view.publishDate && view.start && view.publishDate !== view.start && '　（預計發布日跟活動開始日不同,我用發布日去比對同期的粉專熱度）'}
      </p>

      <div className="judge-rewards">
        <strong>活動獎勵</strong>
        {view.rewards.length === 0 && (
          <p className="forecast-warn">
            文案裡沒抓到獎勵。可能是寫法我還沒見過,請手動加一項;
            或先確認文案有寫「活動獎勵」「參加獎勵」之類的欄位。
          </p>
        )}
        {view.rewards.map((r, i) => (
          <div className="judge-row" key={i}>
            <span className="judge-raw" title={r.raw}>{r.raw}</span>
            <select value={r.key} onChange={(e) => setReward(i, e.target.value)}>
              <option value="">（對不到品項，請選）</option>
              {ITEM_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <button className="icon-btn" aria-label={`移除 ${r.raw}`} onClick={() => removeReward(i)}>×</button>
          </div>
        ))}
        <button className="secondary" onClick={addReward}>＋ 手動加一項獎勵</button>
      </div>

      {!auto.isCampaign && text.trim() && (
        <p className="forecast-warn">
          這則文案看起來不像留言互動型活動(沒有要求留言/截圖/投稿,或沒有獎勵物品)。
          還是會估,但請先確認上面的欄位。
        </p>
      )}
      {note && <p className="forecast-warn">{note}</p>}

      {result && result.ok && <>
        <div className="performance-subtitle">② 預估成效</div>
        <div className="performance-result" role="status">
          <div className="performance-range">約 {num(result.expected)} 則留言</div>
          <p>常見區間 {num(result.low)}–{num(result.high)} 則;
            參考 {result.sampleSize} 則活動,信心{result.confidence === 'high' ? '較高' : result.confidence === 'medium' ? '中等' : '偏低'}。</p>
          {result.season?.factor && (
            <label className="check-row">
              <input type="checkbox" checked={season} onChange={(e) => setSeason(e.target.checked)} />
              套用 {result.season.month} 月的季節係數 ×{result.season.factor}（{result.season.n} 則）
            </label>
          )}
          {result.explain.map((line, i) => <p className="forecast-basis" key={i}>{line}</p>)}
          {result.warnings.map((w, i) => <p className="forecast-warn" key={i}>⚠ {w}</p>)}
          <p className="forecast-caveat">{result.caveat}</p>
        </div>

        <div className="performance-subtitle">③ 對標活動（這個預估參考了哪幾則）</div>
        <p className="muted">
          「校正後」是把當時的留言數換算到 {result.period} 的粉專熱度水準。
          粉專基礎熱度一直在變,不校正就會高估舊活動。
        </p>
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead><tr>
              <th>日期</th><th>活動</th><th>獎勵</th><th>參與方式</th>
              <th>當時留言</th><th>校正後</th><th></th>
            </tr></thead>
            <tbody>
              {result.comparables.map((c, i) => (
                <tr key={i}>
                  <td className="d">{c.date}</td>
                  <td className="t">{c.title}</td>
                  <td className="rw">{c.rewards}</td>
                  <td className="d">{c.difficulty}</td>
                  <td className="n">{num(c.comments)}</td>
                  <td className="n hi">{num(c.adjustedComments)}<small>×{c.factor}</small></td>
                  <td className="lk">{c.permalink && <a href={c.permalink} target="_blank" rel="noreferrer">看貼文</a>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>}

      {result && !result.ok && <p className="forecast-warn">{result.reason}</p>}
      {!text.trim() && <p className="muted">貼上文案後就會自動判讀並預估。</p>}

      <details className="performance-history">
        <summary>基準表內容 <span>{base.items.length} 種獎勵・{base.activities.length} 則活動 ＋</span></summary>
        <p className="muted">{base.source}（{base.generatedAt} 產生）</p>
        {base.caveats.map((c, i) => <p className="muted" key={i}>・{c}</p>)}
        <p className="muted">內建品類對照 {BUILTIN_ALIASES.length} 筆{aliases.length ? `,你補了 ${aliases.length} 筆` : ''}。</p>
        <div className="performance-subtitle">依參與方式</div>
        <table className="compare-table"><thead><tr><th>參與方式</th><th>則數</th><th>留言中位數</th><th>常見區間</th></tr></thead>
          <tbody>{base.difficulty.map((d) => (
            <tr key={d.label}><td>{d.label}</td><td className="n">{d.n}</td><td className="n hi">{num(d.median)}</td><td className="n">{num(d.p25)}–{num(d.p75)}</td></tr>
          ))}</tbody></table>
        <div className="performance-subtitle">依發放方式</div>
        <table className="compare-table"><thead><tr><th>發放方式</th><th>則數</th><th>留言中位數</th><th>常見區間</th></tr></thead>
          <tbody>{base.delivery.map((d) => (
            <tr key={d.label}><td>{d.label}</td><td className="n">{d.n}</td><td className="n hi">{num(d.median)}</td><td className="n">{num(d.p25)}–{num(d.p75)}</td></tr>
          ))}</tbody></table>
        <div className="performance-subtitle">獎勵魅力度</div>
        <table className="compare-table"><thead><tr><th>獎勵</th><th>則數</th><th>留言中位數</th><th>魅力度</th><th>分級</th></tr></thead>
          <tbody>{base.items.map((i) => (
            <tr key={i.item + i.qty}><td>{i.item}{i.qty ? ' ×' + i.qty : ''}</td><td className="n">{i.posts}</td>
              <td className="n">{num(i.median)}</td><td className="n hi">{i.score}</td><td>{i.grade}</td></tr>
          ))}</tbody></table>
      </details>
    </section>
  );
}
