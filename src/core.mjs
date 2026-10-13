export const initial = {name:'秋日冒險・好禮集結',time:'2026/10/15 – 2026/10/31',rewards:'限定冒險禮盒 × 1\n星光寶石 × 100',conditions:'活動期間完成每日任務，累積登入 7 天即可領取。',cta:'立即參加',headline:'秋日冒險\n好禮集結'};
export const ALWAYS_HASHTAG='#CSO絕對武力';
export const OPTIONAL_HASHTAGS=['#全新角色','#王牌武器','#黑市','#史詩武器','#限時好禮','#免費序號','#通通有獎','#留言就抽'];
export const defaultStyle = {name:'暖橘遊戲季',tone:'可愛有鋪陳',accent:'#ef743c',visualMood:'夢幻光影',visualNotes:'',hashtags:'',selectedHashtags:[],examples:[]};
export function validateActivity(a){return ['name','time','rewards','conditions'].every(k=>typeof a[k]==='string'&&a[k].trim())?'':'請完整填寫活動名稱、時間、獎勵與條件。';}
export function parseStyle(text){const s=JSON.parse(text); if(!s||Array.isArray(s)||typeof s!=='object')throw Error('請匯入 JSON 物件。');for(const k of ['name','tone','hashtags','visualMood'])if(s[k]!==undefined&&(typeof s[k]!=='string'||s[k].length>200))throw Error('風格文字欄位須為 200 字以內。');if(s.visualNotes!==undefined&&(typeof s.visualNotes!=='string'||s.visualNotes.length>300))throw Error('圖片想法須為 300 字以內。');if(s.accent!==undefined&&!/^#[0-9a-f]{6}$/i.test(s.accent))throw Error('accent 須為六位十六進位色碼。');if(s.selectedHashtags!==undefined&&(!Array.isArray(s.selectedHashtags)||s.selectedHashtags.some(x=>!OPTIONAL_HASHTAGS.includes(x))))throw Error('可選 Hashtag 須從指定清單選取。');if(s.examples!==undefined&&(!Array.isArray(s.examples)||s.examples.length>20||s.examples.some(x=>typeof x!=='string'||x.length>3000)))throw Error('examples 須為最多 20 篇、每篇 3000 字內的文字陣列。');return {...defaultStyle,...Object.fromEntries(Object.entries(s).filter(([k])=>['name','tone','accent','hashtags','selectedHashtags','visualMood','visualNotes','examples'].includes(k)))};}
export function composeHashtags(s){const custom=typeof s.hashtags==='string'?s.hashtags.match(/#[^\s#,，]+/gu)||[]:[];return [...new Set([ALWAYS_HASHTAG,...OPTIONAL_HASHTAGS.filter(x=>s.selectedHashtags?.includes(x)),...custom])].join(' ');}
// Offline style draft. Only surface features are taken from examples; old campaign facts never enter the new copy.
export function analyzeExamples(examples=[]){
 const source=examples.filter(x=>typeof x==='string'&&x.trim()).join('\n');
 const friendly=/神槍手們|寶貝們|冒險家們|玩家們|朋友們|夥伴們|粉絲們|神槍手|寶貝|冒險家|玩家|朋友|夥伴|大家|各位/.exec(source)?.[0]||'大家';
 const emoji=[...new Set(source.match(/[\p{Extended_Pictographic}]/gu)||[])].filter(x=>!['📅','🎁','📌'].includes(x)).slice(0,2);
 const questions=(source.match(/[？?]/g)||[]).length;
 const exclamations=(source.match(/[！!]/g)||[]).length;
 const playful=/啦|囉|喔|唷|耶|～|~/.test(source);
 const warm=/一起|陪|喜歡|期待|快來|邀請/.test(source);
 const bracketTitle=/【[^】]{2,80}】/.test(source);
 const reminder=/小提醒|記得|注意|別忘了/.test(source);
 const traits=[bracketTitle?'活動標題':null,warm?'情境邀請':null,reminder?'貼心提醒':null,playful?'口語句尾':null,emoji.length?'表情符號':null].filter(Boolean);
 return {count:examples.filter(x=>typeof x==='string'&&x.trim()).length,friendly,emoji,questions,exclamations,playful,warm,bracketTitle,reminder,traits};
}
function sceneFor(name){
 if(/中秋|月兔|賞月/.test(name))return {opening:'中秋就是要把好消息和喜歡的人聚在一起呀！',icon:'🌕'};
 if(/秋日|秋季/.test(name))return {opening:'秋日的小確幸，當然要和大家一起分享呀！',icon:'🍁'};
 if(/週年|周年|生日/.test(name))return {opening:'值得紀念的日子，怎麼能少了和大家一起開心的理由！',icon:'🎉'};
 if(/聖誕|耶誕/.test(name))return {opening:'節日的期待感，從一則好消息開始！',icon:'🎄'};
 if(/新年|春節|過年/.test(name))return {opening:'新的一年，想把第一份好心情分享給大家！',icon:'🧧'};
 return {opening:'有個好消息，想第一時間和大家分享！',icon:'✨'};
}
export function generateDrafts(a,s){
 const error=validateActivity(a);if(error)throw Error(error);
 const v=analyzeExamples(s.examples);
 const calm=s.tone==='沉穩';
 const scene=sceneFor(a.name);
 const icon=scene.icon;
 const heart=v.emoji.find(x=>['💕','💖','💛','🧡','✨','🌟'].includes(x))||(calm?'✨':'💛');
 const address=v.count&&v.friendly!=='大家'?v.friendly:'大家';
 const reward=a.rewards.split(/\r?\n/).map(x=>x.trim()).find(Boolean);
 const rewardHint=reward.length<=55?`「${reward}」`:'這次的活動獎勵';
 const softEnd=v.playful?'快一起來參加吧～✨':v.warm?'期待和你一起參加！':calm?'期待你的參與。':'快一起來看看吧～✨';
 const title=v.bracketTitle?`【${a.name}${icon}】`:`${icon} ${a.name}`;
 const reminder=v.reminder?'💛 小提醒：參加前記得看清楚活動方式，才不會錯過獎勵唷！':'參加前別忘了確認活動方式與時間喔！';
 const intro=[
  {title:'情境鋪陳',body:`${title}\n${scene.opening} ${heart}\n\n${address}，這次「${a.name}」也想邀你一起參與。獎勵清單裡有${rewardHint}，是不是有點心動了呢？\n\n先把時間和參加方式收好，接下來就一起看看怎麼參加吧～`},
  {title:'驚喜揭曉',body:`${title}\n叮咚～${address}，有件開心事想跟你說！${heart}\n\n先賣個小關子：這回的驚喜跟${rewardHint}有關。猜到了嗎？就是「${a.name}」啦！\n\n想一起加入的話，活動時間和方式都幫你整理好囉，往下看就知道了。`},
  {title:'朋友邀請',body:`${title}\n${scene.opening}\n\n看到${rewardHint}，是不是也想把「${a.name}」放進這陣子的小期待裡？${address}，這次也邀請你一起來看看 ${heart}\n\n別怕漏掉重點，活動時間、獎勵和參加方式都在下面；我們一步一步看吧！`}
 ];
 const facts=`📅 活動時間\n${a.time}\n\n🌟 活動方式\n${a.conditions}\n\n🎁 活動獎勵\n${a.rewards}`;
 const summary=v.count?`已參考 ${v.count} 篇歷史文案的${v.traits.join('、')||'開場稱呼與行文節奏'}；活動日期、獎勵和條件只取自本次輸入。`:'尚未提供歷史文案，先用親切的預設語氣；貼上案例後可再產生。';
 return intro.map(({title,body})=>({mode:'offline',title,copy:`${body}\n\n${facts}\n\n${reminder}\n${a.cta}\n${softEnd}\n\n${composeHashtags(s)}`.trim(),styleSummary:summary,concept:`${summary} 背景由程式繪製，未呼叫 AI。原廠素材維持原樣。`}));
}
export async function generateMock(a,s){return generateDrafts(a,s)[0];}
export function contain(iw,ih,x,y,w,h){const scale=Math.min(w/iw,h/ih);return {x:x+(w-iw*scale)/2,y:y+(h-ih*scale)/2,w:iw*scale,h:ih*scale};}
