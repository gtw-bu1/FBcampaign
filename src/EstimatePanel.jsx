// 活動成效預估面板。2026-11-20 整個重做,取代原本「手填歷史活動 CSV」那一套。
//
// 流程照使用者指定的四段:進行預估 → AI 初判(可改)→ 預估成效 → 對標活動。
// 重點:**初判的每一項都可以改**。文案寫法千變萬化,判錯時她改一下比我猜對更實在。
import React, { useMemo, useState, useEffect } from 'react';
import {
  detectDraft, estimate, itemKey, durationDays,
  BASELINE, DIFFICULTY_LIST, DELIVERY_LIST
} from './estimate.mjs';
import './performance.css';

const today = () => new Date().toISOString().slice(0, 10);
const num = (v) => new Intl.NumberFormat('zh-TW').format(v);

// 基準表裡的品項,給下拉選單用。樣本多的排前面
const ITEM_OPTIONS = BASELINE.items
  .slice()
  .sort((a, b) => b.posts - a.posts || b.score - a.score)
  .map((i) => ({
    key: i.item + '｜' + i.qty,
    label: `${i.item}${i.qty ? ' ×' + i.qty : ''}（${i.posts} 則・魅力度 ${i.score}${i.grade === '樣本不足' ? '・樣本不足' : '・' + i.grade + ' 級'}）`
  }));

export default function EstimatePanel({ activity = {}, copy = '', embedded = false }) {
  // 預估的文字來源:優先用 AI 生成的文案,沒有就用活動欄位拼出來
  const fallbackText = useMemo(() => [
    activity.name, activity.time, activity.rewards, activity.conditions
  ].filter(Boolean).join('\n'), [activity.name, activity.time, activity.rewards, activity.conditions]);

  const [text, setText] = useState(copy || fallbackText);
  const [touchedText, setTouchedText] = useState(false);
  const [publishDate, setPublishDate] = useState(today());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [judged, setJudged] = useState(null);     // 初判結果(可被使用者改)
  const [season, setSeason] = useState(false);
  const [note, setNote] = useState('');

  // 文案或活動內容變了,把來源文字跟著更新(除非使用者自己改過)
  useEffect(() => {
    if (touchedText) return;
    setText(copy || fallbackText);
  }, [copy, fallbackText, touchedText]);

  function runDetect() {
    const source = text.trim();
    if (!source) { setNote('先填活動內容或產生文案,才有東西可以判讀。'); return; }
    const d = detectDraft(source, { start, end });
    setJudged({
      rewards: d.rewards.map((r) => ({
        raw: r.raw,
        key: r.matchedItem ? r.matchedItem + '｜' + r.matchedQty : ''
      })),
      difficulty: d.difficulty,
      delivery: d.delivery,
      start, end,
      isCampaign: d.isCampaign,
      rewardLines: d.rewardLines
    });
    setNote(d.isCampaign
      ? ''
      : '這則文案看起來不像留言互動型活動(沒有要求留言/截圖/投稿,或沒有獎勵物品)。還是可以預估,但請確認初判。');
  }

  const result = useMemo(() => {
    if (!judged) return null;
    const keys = judged.rewards.map((r) => r.key).filter(Boolean);
    const detected = {
      rewards: judged.rewards.map((r) => {
        const item = BASELINE.items.find((i) => i.item + '｜' + i.qty === r.key);
        return {
          raw: r.raw,
          matchedItem: item ? item.item : '',
          matchedQty: item ? String(item.qty) : '',
          grade: item ? item.grade : '',
          score: item ? item.score : null
        };
      }),
      difficulty: judged.difficulty,
      delivery: judged.delivery,
      start: judged.start,
      end: judged.end
    };
    return estimate(detected, {
      publishDate: publishDate || judged.start,
      useSeasonFactor: season,
      itemKeys: keys.length ? keys : null
    });
  }, [judged, publishDate, season]);

  const duration = durationDays(judged?.start ?? start, judged?.end ?? end);

  function setReward(index, key) {
    setJudged((cur) => ({ ...cur, rewards: cur.rewards.map((r, i) => (i === index ? { ...r, key } : r)) }));
  }
  function addReward() {
    setJudged((cur) => ({ ...cur, rewards: [...cur.rewards, { raw: '（手動加入）', key: '' }] }));
  }
  function removeReward(index) {
    setJudged((cur) => ({ ...cur, rewards: cur.rewards.filter((_, i) => i !== index) }));
  }

  return (
    <section className={embedded ? 'card performance-card embedded' : 'card performance-card'}>
      <div className="section-title">
        <span className="step">預</span><h2>活動成效預估</h2>
        <span className="required">依 {BASELINE.activities.length} 則真實活動・非 AI 猜測</span>
      </div>
      <p className="muted">
        參考這個粉專過去 {BASELINE.activities.length} 則活動貼文的實際留言數,
        加上獎勵魅力度與參與方式來估。每個數字都看得到是參考哪幾則算出來的。
      </p>

      <div className="performance-subtitle">① 進行預估</div>
      <label className="field">要預估的文案
        <textarea rows={6} value={text} maxLength={8000}
          onChange={(e) => { setText(e.target.value); setTouchedText(true); }}
          placeholder="貼上這次要發的活動文案,或先在左邊填活動內容、按 AI 生成文案" />
      </label>
      <div className="performance-grid">
        <label className="field">預計發布日
          <input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
        </label>
        <label className="field">活動開始
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">活動結束
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <button className="generate performance-estimate" onClick={runDetect}>開始預估 <span>→</span></button>
      {note && <p className="forecast-warn">{note}</p>}

      {judged && <>
        <div className="performance-subtitle">② AI 初判（可以改）</div>
        <p className="muted">
          以下是我從文案判讀出來的。判錯的地方直接改,改完預估會立刻跟著變。
          {judged.rewardLines.length > 0 && <>　文案裡抓到的獎勵行:{judged.rewardLines.map((l, i) => <code key={i}>{l}</code>)}</>}
        </p>
        <div className="judge-rewards">
          <strong>獎勵內容</strong>
          {judged.rewards.length === 0 && <p className="forecast-warn">沒有從文案抓到獎勵,請手動加一項。</p>}
          {judged.rewards.map((r, i) => (
            <div className="judge-row" key={i}>
              <span className="judge-raw">{r.raw}</span>
              <select value={r.key} onChange={(e) => setReward(i, e.target.value)}>
                <option value="">（對不到品項，請選）</option>
                {ITEM_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
              <button className="icon-btn" aria-label={`移除 ${r.raw}`} onClick={() => removeReward(i)}>×</button>
            </div>
          ))}
          <button className="secondary" onClick={addReward}>＋ 手動加一項獎勵</button>
        </div>
        <div className="performance-grid">
          <label className="field">參與方式
            <select value={judged.difficulty} onChange={(e) => setJudged({ ...judged, difficulty: e.target.value })}>
              {DIFFICULTY_LIST.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="field">發放方式
            <select value={judged.delivery} onChange={(e) => setJudged({ ...judged, delivery: e.target.value })}>
              {DELIVERY_LIST.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="field">檔期開始
            <input type="date" value={judged.start} onChange={(e) => setJudged({ ...judged, start: e.target.value })} />
          </label>
          <label className="field">檔期結束
            <input type="date" value={judged.end} onChange={(e) => setJudged({ ...judged, end: e.target.value })} />
          </label>
        </div>
        <p className="performance-duration">
          檔期長度:{duration === null ? '填了起迄日期才算得出來' : `${duration} 天（含頭尾）`}
        </p>
      </>}

      {result && result.ok && <>
        <div className="performance-subtitle">③ 預估成效</div>
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

        <div className="performance-subtitle">④ 對標活動（這個預估參考了哪幾則）</div>
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

      <details className="performance-history">
        <summary>基準表內容 <span>{BASELINE.items.length} 種獎勵・{BASELINE.activities.length} 則活動 ＋</span></summary>
        <p className="muted">{BASELINE.source}（{BASELINE.generatedAt} 產生）</p>
        {BASELINE.caveats.map((c, i) => <p className="muted" key={i}>・{c}</p>)}
        <div className="performance-subtitle">依參與方式</div>
        <table className="compare-table"><thead><tr><th>參與方式</th><th>則數</th><th>留言中位數</th><th>常見區間</th></tr></thead>
          <tbody>{BASELINE.difficulty.map((d) => (
            <tr key={d.label}><td>{d.label}</td><td className="n">{d.n}</td><td className="n hi">{num(d.median)}</td><td className="n">{num(d.p25)}–{num(d.p75)}</td></tr>
          ))}</tbody></table>
        <div className="performance-subtitle">依發放方式</div>
        <table className="compare-table"><thead><tr><th>發放方式</th><th>則數</th><th>留言中位數</th><th>常見區間</th></tr></thead>
          <tbody>{BASELINE.delivery.map((d) => (
            <tr key={d.label}><td>{d.label}</td><td className="n">{d.n}</td><td className="n hi">{num(d.median)}</td><td className="n">{num(d.p25)}–{num(d.p75)}</td></tr>
          ))}</tbody></table>
        <div className="performance-subtitle">獎勵魅力度</div>
        <table className="compare-table"><thead><tr><th>獎勵</th><th>則數</th><th>留言中位數</th><th>魅力度</th><th>分級</th></tr></thead>
          <tbody>{BASELINE.items.map((i) => (
            <tr key={i.item + i.qty}><td>{i.item}{i.qty ? ' ×' + i.qty : ''}</td><td className="n">{i.posts}</td>
              <td className="n">{num(i.median)}</td><td className="n hi">{i.score}</td><td>{i.grade}</td></tr>
          ))}</tbody></table>
      </details>
    </section>
  );
}
