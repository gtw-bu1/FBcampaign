export const HISTORY_STORAGE_KEY='fb-campaign-history-v1';
export const HISTORY_HEADERS=['活動名稱','開始日期','結束日期','參加難易度','獎勵價值','檔期','最終參與人數','獎勵發放方式','活動條件','獎勵內容','曝光人數'];
export const SEASONS=['淡季','平季','旺季'];
export const REWARD_MODES=['抽獎','符合條件即送','混合'];

function dateValue(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const date=new Date(`${value}T00:00:00Z`);
 return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value?date.getTime():null;
}
export function durationDays(start,end){
 const a=dateValue(start),b=dateValue(end);
 if(a===null||b===null||b<a)return null;
 const days=Math.round((b-a)/86400000)+1;
 return days<=366?days:null;
}
export function inferDuration(time){
 const matches=String(time||'').match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/g)||[];
 if(matches.length<2)return null;
 const dates=matches.slice(0,2).map(x=>x.replaceAll('/','-').split('-').map((part,i)=>i?part.padStart(2,'0'):part).join('-'));
 return durationDays(...dates);
}
export function inferAssessment(activity){
 const conditions=String(activity.conditions||'');
 const rewards=String(activity.rewards||'');
 let difficulty=2;
 if(/累積|連續|每日|每天|多日|[3-9]\s*天|\d+\s*週/.test(conditions))difficulty=4;
 else if(/拍照|截圖|上傳|投稿|完成任務|指定關卡|消費|購買/.test(conditions))difficulty=3;
 else if(/登入|留言|按讚|分享|輸入序號/.test(conditions))difficulty=1;
 if(/同時|並|以及|完成.*再|且/.test(conditions))difficulty=Math.min(5,difficulty+1);
 let rewardValue=3;
 if(/限定角色|史詩|傳說|永久|稀有|高價|萬元|萬元以上/.test(rewards))rewardValue=5;
 else if(/角色|武器|造型|自選|限定/.test(rewards))rewardValue=4;
 else if(/消耗品|小禮|少量|體驗券/.test(rewards))rewardValue=2;
 const rewardMode=inferRewardMode(`${conditions}\n${rewards}`);
 const duration=inferDuration(activity.time);
 return {difficulty,rewardValue,rewardMode,duration:duration??7,season:'',scale:inferScale(difficulty,rewardValue,duration??7),notes:[`依參加條件初判難易度 ${difficulty}/5`,`獎勵價值先估 ${rewardValue}/5，請依實際市場價值調整`,rewardMode?`文字顯示為「${rewardMode}」，請核對發放規則`:'獎勵發放方式無法從文字確定，請手動選擇',duration?`依日期推得 ${duration} 天`:'無法從活動時間判讀起迄日期，暫以 7 天顯示，請手動調整']};
}
export function inferRewardMode(text){
 const source=String(text||'');
 const lottery=/抽獎|抽出|抽選|抽中|抽取|抽送|留言就抽|留言抽|幸運兒|抽\s*\d+\s*名/.test(source);
 const guaranteed=/留言就送|留言即送|留言即可獲得|登入就送|參加即送|參與即得|符合條件即送|完成即送|完成就送|人人有獎|通通有獎|保底|參與.*即可獲得|完成.*即可領取/.test(source);
 return lottery&&guaranteed?'混合':lottery?'抽獎':guaranteed?'符合條件即送':'';
}
export function inferScale(difficulty,rewardValue,duration){
 const time=duration>=30?5:duration>=14?4:duration>=7?3:duration>=3?2:1;
 const score=difficulty*.25+rewardValue*.4+time*.35;
 return score<2.35?'小型':score<3.65?'中型':'大型';
}
export function validateRecord(input){
 const name=String(input.name||'').trim();
 const start=String(input.start||'').trim(),end=String(input.end||'').trim();
 const difficulty=Number(input.difficulty),rewardValue=Number(input.rewardValue),participants=Number(input.participants);
 const season=String(input.season||'').trim();
 const rewardMode=input.rewardMode==null?'未分類':String(input.rewardMode).trim();
 const reach=String(input.reach??'').trim();
 if(!name||name.length>80)throw Error('活動名稱須為 1–80 字。');
 const duration=durationDays(start,end);
 if(duration===null)throw Error('開始／結束日期請用 YYYY-MM-DD，活動期間須為 1–366 天。');
 if(!Number.isInteger(difficulty)||difficulty<1||difficulty>5)throw Error('參加難易度須為 1–5。');
 if(!Number.isInteger(rewardValue)||rewardValue<1||rewardValue>5)throw Error('獎勵價值須為 1–5。');
 if(!SEASONS.includes(season))throw Error('檔期須為淡季、平季或旺季。');
 if(![...REWARD_MODES,'未分類'].includes(rewardMode))throw Error('獎勵發放方式須為抽獎、符合條件即送或混合。');
 if(!/^(0|[1-9]\d*)$/.test(String(input.participants??'').trim())||!Number.isSafeInteger(participants))throw Error('最終參與人數須為非負整數。');
 if(reach&&!(/^(0|[1-9]\d*)$/.test(reach)&&Number.isSafeInteger(Number(reach))))throw Error('曝光人數須為非負整數或留空。');
 return {name,start,end,duration,difficulty,rewardValue,season,participants,rewardMode,conditions:String(input.conditions||'').slice(0,1500),rewards:String(input.rewards||'').slice(0,500),reach:reach?Number(reach):null};
}
function csvRows(text){
 const rows=[];let row=[],field='',quoted=false;
 const source=String(text||'').replace(/^\uFEFF/,'');
 for(let i=0;i<source.length;i++){
  const c=source[i];
  if(quoted){if(c==='"'&&source[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}
  else if(c==='"'){if(field)throw Error('CSV 引號格式不正確。');quoted=true;}
  else if(c===','){row.push(field);field='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&source[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()))rows.push(row);row=[];}
  else field+=c;
 }
 if(quoted)throw Error('CSV 引號未關閉。');
 row.push(field);if(row.some(x=>x.trim()))rows.push(row);
 return rows;
}
export function parseHistoryCsv(text){
 if(String(text||'').length>500000)throw Error('CSV 檔案須小於 500 KB。');
 const rows=csvRows(text);
 if(!rows.length)throw Error('CSV 是空的。');
 const headers=rows.shift().map(x=>x.trim());
 for(const required of HISTORY_HEADERS.slice(0,7))if(!headers.includes(required))throw Error(`缺少欄位「${required}」。請下載範本確認格式。`);
 if(rows.length>200)throw Error('一次最多匯入 200 檔活動。');
 const records=rows.map((row,index)=>{
  const get=header=>headers.includes(header)?row[headers.indexOf(header)]??'':undefined;
  try{return validateRecord({name:get('活動名稱'),start:get('開始日期'),end:get('結束日期'),difficulty:get('參加難易度'),rewardValue:get('獎勵價值'),season:get('檔期'),participants:get('最終參與人數'),rewardMode:get('獎勵發放方式'),conditions:get('活動條件'),rewards:get('獎勵內容'),reach:get('曝光人數')});}
  catch(error){throw Error(`第 ${index+2} 列：${error.message}`);}
 });
 if(!records.length)throw Error('請至少填入一筆歷史活動。');
 return records;
}
function escapeCsv(value){const s=String(value??'');return /[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
export function historyCsv(records=[]){
 const values=records.map(r=>[r.name,r.start,r.end,r.difficulty,r.rewardValue,r.season,r.participants,r.rewardMode??'未分類',r.conditions,r.rewards,r.reach??'']);
 return '\uFEFF'+[HISTORY_HEADERS,...values].map(row=>row.map(escapeCsv).join(',')).join('\r\n')+'\r\n';
}
export function loadHistory(storage){
 try{const raw=storage?.getItem(HISTORY_STORAGE_KEY);if(!raw)return [];const list=JSON.parse(raw);return Array.isArray(list)?list.slice(0,200).map(validateRecord):[];}catch{return [];}
}
export function saveHistory(storage,records){
 try{if(!storage)return false;storage.setItem(HISTORY_STORAGE_KEY,JSON.stringify(records.slice(0,200)));return true;}catch{return false;}
}
const median=values=>{const sorted=[...values].sort((a,b)=>a-b);const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
function rank(values){return values.map(x=>{const lower=values.filter(y=>y<x).length;const equal=values.filter(y=>y===x).length;return lower+(equal+1)/2;});}
function correlation(x,y){const a=rank(x),b=rank(y),am=a.reduce((p,c)=>p+c,0)/a.length,bm=b.reduce((p,c)=>p+c,0)/b.length;const numerator=a.reduce((v,c,i)=>v+(c-am)*(b[i]-bm),0);const ax=a.reduce((v,c)=>v+(c-am)**2,0),by=b.reduce((v,c)=>v+(c-bm)**2,0);return ax&&by?numerator/Math.sqrt(ax*by):null;}
export function analyzeHistory(records){
 const valid=records.map(validateRecord);
 const modes=REWARD_MODES.map(rewardMode=>{const group=valid.filter(x=>x.rewardMode===rewardMode);return {rewardMode,count:group.length,median:group.length>=3?median(group.map(x=>x.participants)):null};});
 const groups=REWARD_MODES.filter(rewardMode=>valid.some(x=>x.rewardMode===rewardMode));
 const comparable=groups.length===1?valid.filter(x=>x.rewardMode===groups[0]):[];
 if(comparable.length<8)return {count:valid.length,trends:[],modes,message:groups.length>1?'抽獎、符合條件即送與混合活動分開看；同一發放方式至少 8 檔，才顯示其他因素的方向性關聯。':'同一發放方式至少 8 檔歷史活動，才顯示因素與人數的方向性關聯；樣本少時很容易看錯趨勢。'};
 const labels=[['難易度','difficulty'],['獎勵價值','rewardValue'],['活動天數','duration']];
 const trends=labels.map(([label,key])=>{const rho=correlation(comparable.map(x=>x[key]),comparable.map(x=>x.participants));return {label,direction:rho===null||Math.abs(rho)<.35?'尚無明顯方向':rho>0?'同向變動':'反向變動',rho};});
 const seasons=SEASONS.map(season=>{const group=comparable.filter(x=>x.season===season);return {season,count:group.length,median:group.length>=3?median(group.map(x=>x.participants)):null};});
 return {count:valid.length,trends,modes,seasons,message:`以下只比較「${groups[0]}」活動的歷史關聯，不代表因果；曝光量、宣傳投入等差異尚未校正。`};
}
const niceNumber=value=>{const step=value>=10000?1000:value>=1000?100:value>=100?10:1;return Math.max(0,Math.round(value/step)*step);};
export function estimateParticipants(records,assessment){
 const valid=records.map(validateRecord);
 if(valid.length<5)return {status:'insufficient',count:valid.length,message:`目前只有 ${valid.length} 檔有效案例；至少 5 檔後才提供初步人數範圍，建議準備 8–10 檔以上。`};
 const {difficulty,rewardValue,duration,season,rewardMode}=assessment;
 if(!Number.isInteger(difficulty)||difficulty<1||difficulty>5||!Number.isInteger(rewardValue)||rewardValue<1||rewardValue>5||!Number.isInteger(duration)||duration<1||duration>366||!SEASONS.includes(season)||!REWARD_MODES.includes(rewardMode))return {status:'invalid',message:'請先確認難易度、獎勵價值、活動天數、檔期與獎勵發放方式。'};
 const sameMode=valid.filter(record=>record.rewardMode===rewardMode);
 if(sameMode.length<3)return {status:'insufficient',count:sameMode.length,message:`目前只有 ${sameMode.length} 檔「${rewardMode}」案例；至少 3 檔同類型活動才做初步估算，避免混用抽獎與即送的人數。`};
 const scale=['小型','中型','大型'].includes(assessment.scale)?assessment.scale:inferScale(difficulty,rewardValue,duration);
 const nearby=sameMode.map(record=>{
  const distance=Math.abs(record.difficulty-difficulty)*.35+Math.abs(record.rewardValue-rewardValue)*.35+Math.abs(Math.log(record.duration/duration))*.55+(record.season===season?0:.65)+(inferScale(record.difficulty,record.rewardValue,record.duration)===scale?0:.25);
  return {...record,distance,weight:Math.exp(-distance)};
 }).sort((a,b)=>a.distance-b.distance).slice(0,Math.min(12,sameMode.length));
 const sum=nearby.reduce((total,x)=>total+x.weight,0);
 const mean=nearby.reduce((total,x)=>total+x.weight*Math.log1p(x.participants),0)/sum;
 const variance=nearby.reduce((total,x)=>total+x.weight*(Math.log1p(x.participants)-mean)**2,0)/sum;
 const spread=Math.max(sameMode.length<5?.65:.4,Math.sqrt(variance)*1.28);
 const center=niceNumber(Math.expm1(mean));
 const low=niceNumber(Math.max(0,Math.expm1(mean-spread)));
 const high=Math.max(low+1,niceNumber(Math.expm1(mean+spread)));
 const lowSimilarity=nearby.slice(0,3).every(x=>x.distance>1.25);
 return {status:'ready',count:sameMode.length,center,low,high,similar:nearby.slice(0,3).map(x=>({name:x.name,participants:x.participants,difficulty:x.difficulty,rewardValue:x.rewardValue,season:x.season,duration:x.duration})),message:lowSimilarity?'同類案例與本次活動仍有差異，區間僅供粗略規劃。':sameMode.length<5?'同類案例只有 3–4 檔，這是低信心的粗略範圍；請再補更多活動。':'根據同類型、相似活動的參加人數計算；區間是經驗範圍，不是保證或統計信賴區間。'};
}
