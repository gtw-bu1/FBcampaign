export const initial = {name:'秋日冒險・好禮集結',time:'2026/10/15 – 2026/10/31',rewards:'限定冒險禮盒 × 1\n星光寶石 × 100',conditions:'活動期間完成每日任務，累積登入 7 天即可領取。',cta:'立即參加',headline:'秋日冒險\n好禮集結'};
export const defaultStyle = {name:'暖橘遊戲季',tone:'活潑',accent:'#ef743c',visualMood:'夢幻光影',visualNotes:'',hashtags:'#秋日冒險 #限時活動',examples:[]};
export function validateActivity(a){return ['name','time','rewards','conditions'].every(k=>typeof a[k]==='string'&&a[k].trim())?'':'請完整填寫活動名稱、時間、獎勵與條件。';}
export function parseStyle(text){const s=JSON.parse(text); if(!s||Array.isArray(s)||typeof s!=='object')throw Error('請匯入 JSON 物件。');for(const k of ['name','tone','hashtags','visualMood'])if(s[k]!==undefined&&(typeof s[k]!=='string'||s[k].length>200))throw Error('風格文字欄位須為 200 字以內。');if(s.visualNotes!==undefined&&(typeof s.visualNotes!=='string'||s.visualNotes.length>300))throw Error('圖片想法須為 300 字以內。');if(s.accent!==undefined&&!/^#[0-9a-f]{6}$/i.test(s.accent))throw Error('accent 須為六位十六進位色碼。');if(s.examples!==undefined&&(!Array.isArray(s.examples)||s.examples.length>20||s.examples.some(x=>typeof x!=='string'||x.length>3000)))throw Error('examples 須為最多 20 篇、每篇 3000 字內的文字陣列。');return {...defaultStyle,...Object.fromEntries(Object.entries(s).filter(([k])=>['name','tone','accent','hashtags','visualMood','visualNotes','examples'].includes(k)))};}
// Offline style draft. Only surface features are taken from examples; old campaign facts never enter the new copy.
export function analyzeExamples(examples=[]){
 const source=examples.filter(x=>typeof x==='string'&&x.trim()).join('\n');
 const friendly=/寶貝|朋友|大家|各位|夥伴|冒險家|玩家|粉絲/.exec(source)?.[0]||'大家';
 const emoji=[...new Set(source.match(/[\p{Extended_Pictographic}]/gu)||[])].filter(x=>!['📅','🎁','📌'].includes(x)).slice(0,2);
 const questions=(source.match(/[？?]/g)||[]).length;
 const exclamations=(source.match(/[！!]/g)||[]).length;
 const playful=/啦|囉|喔|唷|耶|～|~/.test(source);
 const warm=/一起|陪|喜歡|期待|快來|邀請/.test(source);
 const traits=[questions?'問句開場':null,exclamations?'熱情語氣':null,playful?'口語句尾':null,warm?'親近邀請':null,emoji.length?'慣用表情符號':null].filter(Boolean);
 return {count:examples.filter(x=>typeof x==='string'&&x.trim()).length,friendly,emoji,questions,exclamations,playful,warm,traits};
}
export async function generateMock(a,s){
 const error=validateActivity(a);if(error)throw Error(error);
 const v=analyzeExamples(s.examples);
 const calm=s.tone==='沉穩'&&!v.exclamations&&!v.playful;
 const icon=v.emoji[0]|| (calm?'':'✨');
 const greeting=v.count?`${v.friendly}，`:(calm?'':'大家，');
 const opening=v.questions?`${greeting}準備好參加「${a.name}」了嗎？`:`${greeting}「${a.name}」${calm?'活動開始了。':'來啦！'}`;
 const invitation=v.warm?'這次也想邀你一起加入，看看有哪些好禮等著你。':v.playful?'好禮都幫你整理好啦，快來看看吧～':calm?'活動重點整理如下，歡迎了解詳情。':'這次的活動重點整理好了，喜歡就先收藏起來吧！';
 const ending=v.playful?'我們活動見囉！':v.warm?'期待和你一起參加！':calm?'期待你的參與。':'等你一起來玩！';
 const copy=`${icon?icon+' ':''}${opening}\n\n${invitation}\n\n📅 活動時間\n${a.time}\n\n🎁 活動獎勵\n${a.rewards}\n\n📌 參加方式\n${a.conditions}\n\n${a.cta}\n${ending}\n\n${s.hashtags||''}`.trim();
 const summary=v.count?`已參考 ${v.count} 篇歷史文案的${v.traits.join('、')||'開場稱呼與行文節奏'}；活動日期、獎勵和條件只取自本次輸入。`:'尚未提供歷史文案，先用親切的預設語氣；貼上案例後可再產生。';
 return {mode:'offline',copy,styleSummary:summary,concept:`${summary} 背景由程式繪製，未呼叫 AI。原廠素材維持原樣。`};
}
export function contain(iw,ih,x,y,w,h){const scale=Math.min(w/iw,h/ih);return {x:x+(w-iw*scale)/2,y:y+(h-ih*scale)/2,w:iw*scale,h:ih*scale};}
