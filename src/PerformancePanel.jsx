import React,{useEffect,useMemo,useState} from 'react';
import {browserStorage} from './saved-style.mjs';
import {analyzeHistory,DIFFICULTY_OPTIONS,durationDays,estimateParticipants,historyCsv,inferAssessment,inferScale,loadHistory,parseHistoryCsv,REWARD_CATEGORIES,REWARD_MODES,saveHistory,SEASONS,validateRecord} from './performance.mjs';
import './performance.css';

const blank={name:'',start:'',end:'',difficultyLabel:'',rewardCategory:'',rewardAmount:'',season:'平季',rewardMode:'',participants:'',conditions:'',rewards:'',reach:''};
const count=value=>new Intl.NumberFormat('zh-TW').format(value);
function downloadCsv(records,filename){
 const url=URL.createObjectURL(new Blob([historyCsv(records)],{type:'text/csv;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
export default function PerformancePanel({activity,embedded=false}){
 const [history,setHistory]=useState(()=>loadHistory(browserStorage()));
 const [draft,setDraft]=useState(blank);
 const [assessment,setAssessment]=useState(()=>inferAssessment(activity));
 const [scaleOverride,setScaleOverride]=useState('');
 const [result,setResult]=useState(null);
 const [message,setMessage]=useState('');
 const analysis=useMemo(()=>analyzeHistory(history),[history]);
 useEffect(()=>{setAssessment(inferAssessment(activity));setScaleOverride('');setResult(null);},[activity.name,activity.time,activity.conditions,activity.rewards]);
 useEffect(()=>{if(!saveHistory(browserStorage(),history)&&history.length)setMessage('瀏覽器無法保存歷史活動，請先匯出 CSV 備份。');setResult(null);},[history]);
 const duration=durationDays(assessment.start,assessment.end);
 const scale=scaleOverride||inferScale(assessment.difficulty||2,assessment.rewardValue||2,duration??7);
 function adjust(key,value){setAssessment(current=>{const next={...current,[key]:value};if(key==='difficultyLabel')next.difficulty=DIFFICULTY_OPTIONS.find(x=>x.label===value)?.score??0;if(key==='rewardCategory'){next.rewardValue=REWARD_CATEGORIES.find(x=>x.label===value)?.score??0;if(value!=='有明確金額價值')next.rewardAmount=null;}if(key==='rewardAmount')next.rewardAmount=value===''?null:Number(value);if(key==='start'||key==='end')next.duration=durationDays(next.start,next.end);return next;});setResult(null);}
 function addRecord(){
  try{
   if(!draft.rewardMode)throw Error('請選擇獎勵發放方式。');
   if(!draft.difficultyLabel||draft.difficultyLabel==='未分類')throw Error('請依對照表選擇參加條件類型。');
   if(!draft.rewardCategory||draft.rewardCategory==='未分類')throw Error('請依對照表選擇獎勵類型。');
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
 const difficultyPicker=(value,onChange)=><select value={value} onChange={onChange}><option value="">請選擇對照類型</option>{value==='未分類'&&<option value="未分類">未分類，請補選</option>}{DIFFICULTY_OPTIONS.map(x=><option key={x.label}>{x.label}</option>)}</select>;
 const rewardPicker=(value,onChange)=><select value={value} onChange={onChange}><option value="">請選擇對照類型</option>{value==='未分類'&&<option value="未分類">未分類，請補選</option>}{REWARD_CATEGORIES.map(x=><option key={x.label}>{x.label}</option>)}</select>;
 return <section className={embedded?'card performance-card embedded':'card performance-card'}>
  <div className="section-title"><span className="step">預</span><h2>成效預估</h2><span className="required">依歷史資料估算</span></div>
  <p className="muted">先確認這檔活動的規模，再用過往活動估算參與人數。沒有足夠資料時不會產生數字。</p>
  <div className="performance-subtitle">① 判定活動規模</div>
  <p className="muted">以下依活動文字提出初判；請用對照表選擇最貼近的類型。若有多項參加條件，選參加者必須完成的最高門檻。</p>
  <div className="performance-grid">
   <label className="field">參加條件類型{difficultyPicker(assessment.difficultyLabel,e=>adjust('difficultyLabel',e.target.value))}</label>
   <label className="field">獎勵類型{rewardPicker(assessment.rewardCategory,e=>adjust('rewardCategory',e.target.value))}</label>
   {assessment.rewardCategory==='有明確金額價值'&&<label className="field">單份主要獎勵估值（NT$）<input type="number" min="1" step="1" value={assessment.rewardAmount??''} onChange={e=>adjust('rewardAmount',e.target.value)}/></label>}
   <label className="field">開始日期<input type="date" value={assessment.start} onChange={e=>adjust('start',e.target.value)}/></label>
   <label className="field">結束日期<input type="date" value={assessment.end} onChange={e=>adjust('end',e.target.value)}/></label>
   <label className="field">檔期<select value={assessment.season} onChange={e=>adjust('season',e.target.value)}><option value="">請確認檔期</option>{SEASONS.map(x=><option key={x}>{x}</option>)}</select></label>
   <label className="field">獎勵發放方式<select value={assessment.rewardMode} onChange={e=>adjust('rewardMode',e.target.value)}><option value="">請確認方式</option>{REWARD_MODES.map(x=><option key={x}>{x}</option>)}</select></label>
  </div>
  <p className="performance-duration">活動天數：{duration===null?'請填有效的起迄日期':`${duration} 天（含開始與結束日）`}</p>
  <details className="performance-guide"><summary>查看參加條件與獎勵類型對照表 <span>＋</span></summary><div className="performance-guide-tables"><div><strong>參加條件</strong><table><tbody>{DIFFICULTY_OPTIONS.map(x=><tr key={x.label}><th scope="row">{x.label}</th><td>{x.description}</td></tr>)}</tbody></table></div><div><strong>獎勵類型</strong><table><tbody>{REWARD_CATEGORIES.map(x=><tr key={x.label}><th scope="row">{x.label}</th><td>{x.description}</td></tr>)}</tbody></table></div></div></details>
  <label className="field performance-scale">活動規模<select value={scale} onChange={e=>{setScaleOverride(e.target.value);setResult(null);}}>{['小型','中型','大型'].map(x=><option key={x}>{x}</option>)}</select></label>
  <p className="muted">文字初判：{assessment.notes.join('；')}。淡旺季由你依實際營運檔期確認；規模分類只是活動描述，不直接當作人數保證。</p>
  <div className="performance-subtitle">② 預估參與人數</div>
  <button className="generate performance-estimate" onClick={()=>setResult(estimateParticipants(history,{...assessment,duration,scale}))}>確認判定並預估 <span>→</span></button>
  {result&&<div className="performance-result" role="status">{result.status==='ready'?<><div className="performance-range">約 {count(result.low)}–{count(result.high)} 人</div><p>相似案例的中心值：約 {count(result.center)} 人；依 {result.count} 檔歷史活動估算。</p><p>{result.message}</p><strong>最相近的 3 檔</strong><ul>{result.similar.map((x,i)=><li key={`${x.name}-${i}`}>{x.name}：{count(x.participants)} 人（{x.season}・{x.duration} 天）</li>)}</ul></>:<p>{result.message}</p>}</div>}
  <details className="performance-history"><summary>歷史活動資料 <span>{history.length} 檔 ＋</span></summary>
   <p className="muted">每列一檔活動，條件與獎勵用上方同一張對照表分類。金額型獎勵填單份主要獎勵的台幣估值；「留言就送」選符合條件即送，參與獎加抽獎選混合。人數請統一填「不重複參加者」。資料只保存在這個瀏覽器。</p>
   <div className="performance-actions"><button className="secondary" onClick={()=>downloadCsv([],'社群活動成效資料範本.csv')}>下載 CSV 範本</button><label className="button secondary">匯入 CSV<input type="file" accept=".csv,text/csv" onChange={importCsv}/></label><button className="secondary" disabled={!history.length} onClick={()=>downloadCsv(history,'社群活動成效備份.csv')}>匯出備份</button></div>
   <div className="performance-subtitle">手動新增一檔</div>
   {historyInput('活動名稱','name')}
   <div className="performance-grid">{historyInput('開始日期','start','date')}{historyInput('結束日期','end','date')}</div>
   <p className="performance-duration">活動天數：{durationDays(draft.start,draft.end)===null?'填寫日期後自動計算':`${durationDays(draft.start,draft.end)} 天（含開始與結束日）`}</p>
   <div className="performance-grid">
    <label className="field">參加條件類型{difficultyPicker(draft.difficultyLabel,e=>setDraft({...draft,difficultyLabel:e.target.value}))}</label>
    <label className="field">獎勵類型{rewardPicker(draft.rewardCategory,e=>setDraft({...draft,rewardCategory:e.target.value,rewardAmount:e.target.value==='有明確金額價值'?draft.rewardAmount:''}))}</label>
    {draft.rewardCategory==='有明確金額價值'&&historyInput('單份主要獎勵估值（NT$）','rewardAmount','number')}
    <label className="field">檔期<select value={draft.season} onChange={e=>setDraft({...draft,season:e.target.value})}>{SEASONS.map(x=><option key={x}>{x}</option>)}</select></label>
    <label className="field">獎勵發放方式<select value={draft.rewardMode} onChange={e=>setDraft({...draft,rewardMode:e.target.value})}><option value="">請選擇</option>{REWARD_MODES.map(x=><option key={x}>{x}</option>)}</select></label>
    {historyInput('最終參與人數','participants','number')}
   </div>
   {historyInput('活動條件（選填）','conditions')}{historyInput('獎勵內容（選填）','rewards')}{historyInput('曝光人數（選填）','reach','number')}
   <button className="secondary performance-add" onClick={addRecord}>保存這檔活動</button>
   {message&&<p className="performance-message" role="status">{message}</p>}
   {history.length>0&&<div className="performance-records">{history.map((record,i)=><div key={`${record.name}-${record.start}-${i}`}><span><strong>{record.name}</strong><small>{record.start} ～ {record.end} · {record.season} · {count(record.participants)} 人</small><small>{record.difficultyLabel} · {record.rewardCategory}{record.rewardAmount?`（NT$ ${count(record.rewardAmount)}）`:''}</small><select aria-label={`${record.name} 獎勵發放方式`} value={record.rewardMode} onChange={e=>setHistory(current=>current.map((x,at)=>at===i?{...x,rewardMode:e.target.value}:x))}><option value="未分類">未分類，請補選</option>{REWARD_MODES.map(x=><option key={x}>{x}</option>)}</select></span><div className="performance-record-actions"><button className="secondary" onClick={()=>{setDraft({...record,rewardAmount:record.rewardAmount??''});setMessage(`已載入「${record.name}」，修改後按「保存這檔活動」。`);}}>編輯</button><button className="icon-btn" aria-label={`移除 ${record.name}`} onClick={()=>setHistory(current=>current.filter((_,at)=>at!==i))}>×</button></div></div>)}</div>}
   <div className="performance-analysis"><strong>歷史關聯觀察</strong><p className="muted">{analysis.message}</p>{analysis.modes?.filter(x=>x.median!==null).map(x=><p key={x.rewardMode}>{x.rewardMode}參與中位數：{count(x.median)} 人（{x.count} 檔）</p>)}{analysis.trends.map(x=><p key={x.label}>{x.label}：{x.direction}</p>)}{analysis.seasons?.filter(x=>x.median!==null).map(x=><p key={x.season}>{x.season}中位數：{count(x.median)} 人（{x.count} 檔）</p>)}</div>
  </details>
 </section>;
}
