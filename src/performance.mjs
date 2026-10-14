export const HISTORY_STORAGE_KEY='fb-campaign-history-v1';
export const HISTORY_HEADERS=['活動名稱','開始日期','結束日期','參加條件類型','獎勵類型','獎勵金額（NT$）','檔期','最終參與人數','獎勵發放方式','活動條件','獎勵內容','曝光人數'];
const LEGACY_HEADERS=['活動名稱','開始日期','結束日期','參加難易度','獎勵價值','檔期','最終參與人數'];
export const SEASONS=['淡季','平季','旺季'];
export const REWARD_MODES=['抽獎','符合條件即送','混合'];
export const DIFFICULTY_OPTIONS=[
 {label:'留言即可',score:1,description:'只需留言或簡單互動即可參加'},
 {label:'需附上圖片',score:2,description:'需拍照、截圖並附圖'},
 {label:'需附上影片',score:3,description:'需錄製並上傳影片'},
 {label:'需達上線時間門檻',score:4,description:'需上線指定分鐘數或多日登入'},
 {label:'需進行投稿',score:5,description:'需製作作品並投稿；多條件活動選最高門檻'}
];
export const REWARD_CATEGORIES=[
 {label:'體驗型天數道具',score:1,description:'限時、試用或有使用天數的道具'},
 {label:'免費且不稀有',score:2,description:'常態可取得的免費獎勵'},
 {label:'免費但稀有',score:4,description:'難取得、限定或稀有的免費獎勵'},
 {label:'有明確金額價值',score:5,description:'填單份主要獎勵的台幣估值'}
];

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
export function inferDates(time){
 const matches=String(time||'').match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/g)||[];
 if(matches.length<2)return {start:'',end:''};
 const dates=matches.slice(0,2).map(x=>x.replaceAll('/','-').split('-').map((part,i)=>i?part.padStart(2,'0'):part).join('-'));
 return durationDays(...dates)===null?{start:'',end:''}:{start:dates[0],end:dates[1]};
}
export function inferDuration(time){const {start,end}=inferDates(time);return durationDays(start,end);}
export function inferAssessment(activity){
 const conditions=String(activity.conditions||'');
 const rewards=String(activity.rewards||'');
 const difficultyLabel=/投稿|徵稿|創作作品/.test(conditions)?'需進行投稿':/上線|在線|累積|連續|每日|每天|\d+\s*分鐘|\d+\s*天/.test(conditions)?'需達上線時間門檻':/影片|錄影|短影音/.test(conditions)?'需附上影片':/圖片|照片|截圖|拍照|附圖/.test(conditions)?'需附上圖片':/留言|登入|按讚|分享|輸入序號/.test(conditions)?'留言即可':'';
 const difficulty=DIFFICULTY_OPTIONS.find(x=>x.label===difficultyLabel)?.score??0;
 const amountMatch=/(?:NT\$|TWD|新台幣|價值)\s*([\d,]+)\s*元?|([\d,]+)\s*元/.exec(rewards);
 const rewardAmount=amountMatch?Number((amountMatch[1]||amountMatch[2]).replaceAll(',','')):null;
 const rewardCategory=rewardAmount?'有明確金額價值':/體驗|試用|\d+\s*天|限時道具/.test(rewards)?'體驗型天數道具':/限定|稀有|史詩|傳說|永久/.test(rewards)?'免費但稀有':'';
 const rewardValue=REWARD_CATEGORIES.find(x=>x.label===rewardCategory)?.score??0;
 const rewardMode=inferRewardMode(`${conditions}\n${rewards}`);
 const {start,end}=inferDates(activity.time);
 const duration=durationDays(start,end);
 return {difficulty,difficultyLabel,rewardValue,rewardCategory,rewardAmount,rewardMode,start,end,duration,season:'',scale:inferScale(difficulty||2,rewardValue||2,duration??7),notes:[difficultyLabel?`參加條件初判為「${difficultyLabel}」`:'參加條件無法判讀，請選擇類型',rewardCategory?`獎勵初判為「${rewardCategory}」`:'獎勵類型無法判讀，請選擇類型',rewardMode?`文字顯示為「${rewardMode}」，請核對發放規則`:'獎勵發放方式無法從文字確定，請手動選擇',duration?`依日期推得 ${duration} 天`:'請填寫開始與結束日期，活動天數會自動計算']};
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
 const difficultyLabel=String(input.difficultyLabel??(input.difficulty==null?'':'未分類')).trim();
 const difficultyOption=DIFFICULTY_OPTIONS.find(x=>x.label===difficultyLabel);
 const difficulty=difficultyOption?.score??(difficultyLabel==='未分類'?Number(input.difficulty??2):NaN);
 const rewardCategory=String(input.rewardCategory??(input.rewardValue==null?'':'未分類')).trim();
 const rewardOption=REWARD_CATEGORIES.find(x=>x.label===rewardCategory);
 const rewardValue=rewardOption?.score??(rewardCategory==='未分類'?Number(input.rewardValue??3):NaN);
 const amountText=String(input.rewardAmount??'').trim();
 const rewardAmount=amountText?Number(amountText):null;
 const participants=Number(input.participants);
 const season=String(input.season||'').trim();
 const rewardMode=input.rewardMode==null?'未分類':String(input.rewardMode).trim();
 const reach=String(input.reach??'').trim();
 if(!name||name.length>80)throw Error('活動名稱須為 1–80 字。');
 const duration=durationDays(start,end);
 if(duration===null)throw Error('開始／結束日期請用 YYYY-MM-DD，活動期間須為 1–366 天。');
 if(!difficultyOption&&!(difficultyLabel==='未分類'&&Number.isInteger(difficulty)&&difficulty>=1&&difficulty<=5))throw Error('參加條件類型須從對照表選取。');
 if(!rewardOption&&!(rewardCategory==='未分類'&&Number.isInteger(rewardValue)&&rewardValue>=1&&rewardValue<=5))throw Error('獎勵類型須從對照表選取。');
 if(rewardCategory==='有明確金額價值'&&(!/^[1-9]\d*$/.test(amountText)||!Number.isSafeInteger(rewardAmount)))throw Error('金額型獎勵請填單份主要獎勵的台幣估值。');
 if(!SEASONS.includes(season))throw Error('檔期須為淡季、平季或旺季。');
 if(![...REWARD_MODES,'未分類'].includes(rewardMode))throw Error('獎勵發放方式須為抽獎、符合條件即送或混合。');
 if(!/^(0|[1-9]\d*)$/.test(String(input.participants??'').trim())||!Number.isSafeInteger(participants))throw Error('最終參與人數須為非負整數。');
 if(reach&&!(/^(0|[1-9]\d*)$/.test(reach)&&Number.isSafeInteger(Number(reach))))throw Error('曝光人數須為非負整數或留空。');
 return {name,start,end,duration,difficulty,difficultyLabel,rewardValue,rewardCategory,rewardAmount:rewardCategory==='有明確金額價值'?rewardAmount:null,season,participants,rewardMode,conditions:String(input.conditions||'').slice(0,1500),rewards:String(input.rewards||'').slice(0,500),reach:reach?Number(reach):null};
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
 const modern=headers.includes('參加條件類型')&&headers.includes('獎勵類型');
 const required=modern?['活動名稱','開始日期','結束日期','參加條件類型','獎勵類型','檔期','最終參與人數','獎勵發放方式']:LEGACY_HEADERS;
 for(const column of required)if(!headers.includes(column))throw Error(`缺少欄位「${column}」。請下載範本確認格式。`);
 if(rows.length>200)throw Error('一次最多匯入 200 檔活動。');
 const records=rows.map((row,index)=>{
  const get=header=>headers.includes(header)?row[headers.indexOf(header)]??'':undefined;
  try{return validateRecord({name:get('活動名稱'),start:get('開始日期'),end:get('結束日期'),difficulty:modern?undefined:get('參加難易度'),difficultyLabel:modern?get('參加條件類型'):undefined,rewardValue:modern?undefined:get('獎勵價值'),rewardCategory:modern?get('獎勵類型'):undefined,rewardAmount:modern?get('獎勵金額（NT$）'):undefined,season:get('檔期'),participants:get('最終參與人數'),rewardMode:get('獎勵發放方式'),conditions:get('活動條件'),rewards:get('獎勵內容'),reach:get('曝光人數')});}
  catch(error){throw Error(`第 ${index+2} 列：${error.message}`);}
 });
 if(!records.length)throw Error('請至少填入一筆歷史活動。');
 return records;
}
function escapeCsv(value){const s=String(value??'');return /[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
export function historyCsv(records=[]){
 const values=records.map(r=>[r.name,r.start,r.end,r.difficultyLabel??'未分類',r.rewardCategory??'未分類',r.rewardAmount??'',r.season,r.participants,r.rewardMode??'未分類',r.conditions,r.rewards,r.reach??'']);
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
 const classified=valid.filter(x=>x.difficultyLabel!=='未分類'&&x.rewardCategory!=='未分類');
 const modes=REWARD_MODES.map(rewardMode=>{const group=classified.filter(x=>x.rewardMode===rewardMode);return {rewardMode,count:group.length,median:group.length>=3?median(group.map(x=>x.participants)):null};});
 const groups=REWARD_MODES.filter(rewardMode=>classified.some(x=>x.rewardMode===rewardMode));
 const comparable=groups.length===1?classified.filter(x=>x.rewardMode===groups[0]):[];
 if(comparable.length<8)return {count:valid.length,trends:[],modes,message:groups.length>1?'抽獎、符合條件即送與混合活動分開看；同一發放方式至少 8 檔，才顯示其他因素的方向性關聯。':'同一發放方式至少 8 檔歷史活動，才顯示因素與人數的方向性關聯；樣本少時很容易看錯趨勢。'};
 const labels=[['參加條件類型','difficulty'],['獎勵類型','rewardValue'],['活動天數','duration']];
 const trends=labels.map(([label,key])=>{const rho=correlation(comparable.map(x=>x[key]),comparable.map(x=>x.participants));return {label,direction:rho===null||Math.abs(rho)<.35?'尚無明顯方向':rho>0?'同向變動':'反向變動',rho};});
 const seasons=SEASONS.map(season=>{const group=comparable.filter(x=>x.season===season);return {season,count:group.length,median:group.length>=3?median(group.map(x=>x.participants)):null};});
 return {count:valid.length,trends,modes,seasons,message:`以下只比較「${groups[0]}」活動的歷史關聯，不代表因果；曝光量、宣傳投入等差異尚未校正。`};
}
const niceNumber=value=>{const step=value>=10000?1000:value>=1000?100:value>=100?10:1;return Math.max(0,Math.round(value/step)*step);};
export function estimateParticipants(records,assessment){
 const valid=records.map(validateRecord).filter(x=>x.difficultyLabel!=='未分類'&&x.rewardCategory!=='未分類'&&REWARD_MODES.includes(x.rewardMode));
 if(valid.length<5)return {status:'insufficient',count:valid.length,message:`目前只有 ${valid.length} 檔已完成分類的有效案例；至少 5 檔後才提供初步人數範圍，建議準備 8–10 檔以上。`};
 const {difficulty,rewardValue,rewardCategory,rewardAmount,duration,season,rewardMode}=assessment;
 if(!DIFFICULTY_OPTIONS.some(x=>x.score===difficulty)||!REWARD_CATEGORIES.some(x=>x.label===rewardCategory&&x.score===rewardValue)||!Number.isInteger(duration)||duration<1||duration>366||!SEASONS.includes(season)||!REWARD_MODES.includes(rewardMode)||(rewardCategory==='有明確金額價值'&&(!Number.isSafeInteger(rewardAmount)||rewardAmount<1)))return {status:'invalid',message:'請先確認參加條件類型、獎勵類型與金額、起迄日期、檔期及獎勵發放方式。'};
 const sameMode=valid.filter(record=>record.rewardMode===rewardMode);
 if(sameMode.length<3)return {status:'insufficient',count:sameMode.length,message:`目前只有 ${sameMode.length} 檔「${rewardMode}」案例；至少 3 檔同類型活動才做初步估算，避免混用抽獎與即送的人數。`};
 const scale=['小型','中型','大型'].includes(assessment.scale)?assessment.scale:inferScale(difficulty,rewardValue,duration);
 const nearby=sameMode.map(record=>{
  const amountDistance=rewardCategory==='有明確金額價值'&&record.rewardCategory==='有明確金額價值'?Math.abs(Math.log(record.rewardAmount/rewardAmount))*.35:0;
  const distance=Math.abs(record.difficulty-difficulty)*.35+Math.abs(record.rewardValue-rewardValue)*.35+(record.rewardCategory===rewardCategory?0:.4)+amountDistance+Math.abs(Math.log(record.duration/duration))*.55+(record.season===season?0:.65)+(inferScale(record.difficulty,record.rewardValue,record.duration)===scale?0:.25);
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
