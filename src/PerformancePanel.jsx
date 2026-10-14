import React,{useEffect,useMemo,useState} from 'react';
import {browserStorage} from './saved-style.mjs';
import {analyzeHistory,estimateParticipants,historyCsv,inferAssessment,inferScale,loadHistory,parseHistoryCsv,saveHistory,SEASONS,validateRecord} from './performance.mjs';
import './performance.css';

const blank={name:'',start:'',end:'',difficulty:'3',rewardValue:'3',season:'平季',participants:'',conditions:'',rewards:'',reach:''};
const scoreOptions=[1,2,3,4,5];
const count=value=>new Intl.NumberFormat('zh-TW').format(value);
function downloadCsv(records,filename){
 const url=URL.createObjectURL(new Blob([historyCsv(records)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export default function PerformancePanel({activity}){
 const [history,setHistory]=useState(()=>loadHistory(browserStorage()));
 const [draft,setDraft]=useState(blank);
 const [assessment,setAssessment]=useState(()=>inferAssessment(activity));
 const [scaleOverride,setScaleOverride]=useState('');
 const [result,setResult]=useState(null);
 const [message,setMessage]=useState('');
 const analysis=useMemo(()=>analyzeHistory(history),[history]);
 useEffect(()=>{setAssessment(inferAssessment(activity));setScaleOverride('');setResult(null);},[activity.name,activity.time,activity.conditions,activity.rewards]);
 useEffect(()=>{if(!saveHistory(browserStorage(),history)&&history.length)setMessage('瀏覽器無法保存歷史活動，請先匯出 CSV 備份。');setResult(null);},[history]);
 const scale=scaleOverride||inferScale(assessment.difficulty,assessment.rewardValue,assessment.duration);
 function adjust(key,value){setAssessment(current=>({...current,[key]:key==='season'?value:Number(value)}));setResult(null);}
 function addRecord(){
  try{
   const record=validateRecord(draft);
   const existing=history.findIndex(x=>x.name===record.name&&x.start===record.start&&x.end===record.end);
   if(existing<0&&history.length>=200)throw Error('最多保存 200 檔歷史活動。');
   setHistory(current=>existing<0?[...current,record]:current.map((x,i)=>i===existing?record:x));
   setDraft(blank);setMessage(existing<0?'已加入歷史活動。':'已更新同名、同日期的活動。');
  }catch(error){setMessage(error.message);}
 }
 async function importCsv(event){
  const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{
   if(file.size>500000)throw Error('CSV 檔案須小於 500 KB。');
   const imported=parseHistoryCsv(await file.text());
   const merged=[...history];
   for(const record of imported){const at=merged.findIndex(x=>x.name===record.name&&x.start===record.start&&x.end===record.end);if(at<0)merged.push(record);else merged[at]=record;}
   if(merged.length>200)throw Error('合併後超過 200 檔活動，請分批整理。');
   setHistory(merged);setMessage(`已匯入 ${imported.length} 檔活動，現在共有 ${merged.length} 檔。`);
  }catch(error){setMessage(`匯入失敗：${error.message}`);}
 }
 const historyInput=(label,key,type='text')=><label className="field">{label}<input type={type} value={draft[key]} onChange={event=>setDraft(current=>({...current,[key]:event.target.value}))}/></label>;
 return <section className="card performance-card">
  <div className="section-title"><span className="step">預</span><h2>成效預估</h2><span className="required">依歷史資料估算</span></div>
  <p className="muted">先確認這檔活動的規模，再用過往活動估算參與人數。沒有足夠資料時不會產生數字。</p>
  <div className="performance-subtitle">① 判定活動規模</div>
  <p className="muted">以下是依條件、獎勵文字與活動日期的規則初判；請按實際情況修改。</p>
  <div className="performance-grid">
   <label className="field">參加難易度<select value={assessment.difficulty} onChange={e=>adjust('difficulty',e.target.value)}>{scoreOptions.map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>
   <label className="field">獎勵價值<select value={assessment.rewardValue} onChange={e=>adjust('rewardValue',e.target.value)}>{scoreOptions.map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>
   <label className="field">活動天數<input type="number" min="1" max="366" value={assessment.duration} onChange={e=>adjust('duration',e.target.value)}/></label>
   <label className="field">檔期<select value={assessment.season} onChange={e=>adjust('season',e.target.value)}><option value="">請確認檔期</option>{SEASONS.map(x=><option key={x}>{x}</option>)}</select></label>
  </div>
  <label className="field performance-scale">活動規模<select value={scale} onChange={e=>{setScaleOverride(e.target.value);setResult(null);}}>{['小型','中型','大型'].map(x=><option key={x}>{x}</option>)}</select></label>
  <p className="muted">初判依據：{assessment.notes.join('；')}。淡旺季由你依實際營運檔期確認；規模分類只是活動描述，不直接當作人數保證。</p>
  <div className="performance-subtitle">② 預估參與人數</div>
  <button className="generate performance-estimate" onClick={()=>setResult(estimateParticipants(history,{...assessment,scale}))}>確認判定並預估 <span>→</span></button>
  {result&&<div className="performance-result" role="status">{result.status==='ready'?<><div className="performance-range">約 {count(result.low)}–{count(result.high)} 人</div><p>相似案例的中心值：約 {count(result.center)} 人；依 {result.count} 檔歷史活動估算。</p><p>{result.message}</p><strong>最相近的 3 檔</strong><ul>{result.similar.map((x,i)=><li key={`${x.name}-${i}`}>{x.name}：{count(x.participants)} 人（{x.season}・{x.duration} 天）</li>)}</ul></>:<p>{result.message}</p>}</div>}
  <details className="performance-history"><summary>歷史活動資料 <span>{history.length} 檔 ＋</span></summary>
   <p className="muted">每列一檔活動。難易度 1＝登入／留言，5＝多步驟或長期任務；獎勵價值 1＝一般小獎，5＝稀有或高價獎。人數請統一填「不重複參加者」。資料只保存在這個瀏覽器。</p>
   <div className="performance-actions"><button className="secondary" onClick={()=>downloadCsv([],'社群活動成效資料範本.csv')}>下載 CSV 範本</button><label className="button secondary">匯入 CSV<input type="file" accept=".csv,text/csv" onChange={importCsv}/></label><button className="secondary" disabled={!history.length} onClick={()=>downloadCsv(history,'社群活動成效備份.csv')}>匯出備份</button></div>
   <div className="performance-subtitle">手動新增一檔</div>
   {historyInput('活動名稱','name')}
   <div className="performance-grid">{historyInput('開始日期','start','date')}{historyInput('結束日期','end','date')}</div>
   <div className="performance-grid">
    <label className="field">參加難易度<select value={draft.difficulty} onChange={e=>setDraft({...draft,difficulty:e.target.value})}>{scoreOptions.map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>
    <label className="field">獎勵價值<select value={draft.rewardValue} onChange={e=>setDraft({...draft,rewardValue:e.target.value})}>{scoreOptions.map(n=><option key={n} value={n}>{n} / 5</option>)}</select></label>
    <label className="field">檔期<select value={draft.season} onChange={e=>setDraft({...draft,season:e.target.value})}>{SEASONS.map(x=><option key={x}>{x}</option>)}</select></label>
    {historyInput('最終參與人數','participants','number')}
   </div>
   {historyInput('活動條件（選填）','conditions')}{historyInput('獎勵內容（選填）','rewards')}{historyInput('曝光人數（選填）','reach','number')}
   <button className="secondary performance-add" onClick={addRecord}>保存這檔活動</button>
   {message&&<p className="performance-message" role="status">{message}</p>}
   {history.length>0&&<div className="performance-records">{history.map((record,i)=><div key={`${record.name}-${record.start}-${i}`}><span><strong>{record.name}</strong><small>{record.start} ～ {record.end} · {record.season} · {count(record.participants)} 人</small></span><button className="icon-btn" aria-label={`移除 ${record.name}`} onClick={()=>setHistory(current=>current.filter((_,at)=>at!==i))}>×</button></div>)}</div>}
   <div className="performance-analysis"><strong>歷史關聯觀察</strong><p className="muted">{analysis.message}</p>{analysis.trends.map(x=><p key={x.label}>{x.label}：{x.direction}</p>)}{analysis.seasons?.filter(x=>x.median!==null).map(x=><p key={x.season}>{x.season}中位數：{count(x.median)} 人（{x.count} 檔）</p>)}</div>
  </details>
 </section>;
}
