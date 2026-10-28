export const initial = {name:'秋日冒險・好禮集結',time:'2026/10/15 – 2026/10/31',rewards:'限定冒險禮盒 × 1\n星光寶石 × 100',conditions:'活動期間完成每日任務，累積登入 7 天即可領取。',cta:'立即參加',headline:'秋日冒險\n好禮集結',subtitle:'',showAssetNames:false};
export const ALWAYS_HASHTAG='#CSO絕對武力';
export const OPTIONAL_HASHTAGS=['#全新角色','#王牌武器','#黑市','#史詩武器','#限時好禮','#免費序號','#通通有獎','#留言就抽'];
export const VISUAL_MOODS=['夢幻光影','節慶紙雕','未來科技','清新插畫','高級質感','霓虹電玩','星光宇宙','暖色手繪'];
export const defaultStyle = {name:'暖橘遊戲季',tone:'可愛有鋪陳',accent:'#ef743c',visualMood:'夢幻光影',visualMoods:['夢幻光影'],visualNotes:'',hashtags:'',selectedHashtags:[],examples:[]};
export function validateActivity(a){return ['name','time','rewards','conditions'].every(k=>typeof a[k]==='string'&&a[k].trim())?'':'請完整填寫活動名稱、時間、獎勵與條件。';}
export function parseStyle(text){const s=JSON.parse(text); if(!s||Array.isArray(s)||typeof s!=='object')throw Error('請匯入 JSON 物件。');for(const k of ['name','tone','hashtags','visualMood'])if(s[k]!==undefined&&(typeof s[k]!=='string'||s[k].length>200))throw Error('風格文字欄位須為 200 字以內。');if(s.visualNotes!==undefined&&(typeof s.visualNotes!=='string'||s.visualNotes.length>300))throw Error('圖片想法須為 300 字以內。');if(s.accent!==undefined&&!/^#[0-9a-f]{6}$/i.test(s.accent))throw Error('accent 須為六位十六進位色碼。');if(s.selectedHashtags!==undefined&&(!Array.isArray(s.selectedHashtags)||s.selectedHashtags.some(x=>!OPTIONAL_HASHTAGS.includes(x))))throw Error('可選 Hashtag 須從指定清單選取。');if(s.visualMoods!==undefined&&(!Array.isArray(s.visualMoods)||s.visualMoods.some(x=>!VISUAL_MOODS.includes(x))))throw Error('圖片氛圍須從指定清單選取。');if(s.examples!==undefined&&(!Array.isArray(s.examples)||s.examples.length>20||s.examples.some(x=>typeof x!=='string'||x.length>3000)))throw Error('examples 須為最多 20 篇、每篇 3000 字內的文字陣列。');const result={...defaultStyle,...Object.fromEntries(Object.entries(s).filter(([k])=>['name','tone','accent','hashtags','selectedHashtags','visualMood','visualMoods','visualNotes','examples'].includes(k)))};if(!Array.isArray(s.visualMoods))result.visualMoods=VISUAL_MOODS.includes(s.visualMood)?[s.visualMood]:[defaultStyle.visualMood];return result;}
export function composeHashtags(s){const custom=typeof s.hashtags==='string'?s.hashtags.match(/#[^\s#,，]+/gu)||[]:[];return [...new Set([ALWAYS_HASHTAG,...OPTIONAL_HASHTAGS.filter(x=>s.selectedHashtags?.includes(x)),...custom])].join(' ');}
export function replaceOpening(copy,opening){const text=String(copy||'');const separator=/\r?\n[ \t]*\r?\n/.exec(text);return separator?opening.trim()+text.slice(separator.index):text?`${opening.trim()}\n\n${text}`:opening.trim();}
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
const themes=[
 {match:/中秋|月兔|賞月/,icon:'🌕',cue:'月色',scenes:['月亮慢慢圓了，這回想收集的可不只有月光。','中秋的夜晚，總適合留一點位置給驚喜。','月色正好，想把這份期待分享給你。','今晚先不數星星，來數數這次有哪些好禮。','團圓的日子，也想讓你的遊戲時光熱鬧一點。','月亮都探頭了，這場活動也該登場啦。','把中秋的儀式感，留給一場值得參與的冒險。','月光照進遊戲裡，新的期待正悄悄發亮。']},
 {match:/秋日|秋季|楓葉/,icon:'🍁',cue:'秋日',scenes:['風一吹，就知道新的冒險季節到了。','把秋天的好心情收好，下一站是活動現場。','秋天適合散步，也適合撿起一份意外的驚喜。','楓葉還沒落完，這場冒險已經準備開跑。','替秋日行程加上一筆：去看看這回的好禮。','這個秋天，想邀你把期待裝得滿滿的。','涼涼的季節，剛好適合來點熱鬧的挑戰。','秋色正濃，冒險清單也該更新了。']},
 {match:/週年|周年|生日|慶典/,icon:'🎉',cue:'慶祝',scenes:['值得紀念的日子，想和你一起留下新的回憶。','今天的慶祝清單，多了一項讓人期待的事。','把掌聲留給一路同行的你，驚喜準備登場。','這次的紀念日，想用一場活動好好慶祝。','派對的燈亮了，屬於你的好消息也到了。','慶祝不只要拍照，還要帶走一點好運。','日子值得紀念，玩法也想來點特別的。','一起把這個重要時刻，變成新的遊戲回憶。']},
 {match:/聖誕|耶誕|雪季/,icon:'🎄',cue:'節慶',scenes:['鈴聲還沒響完，驚喜已經先到門口了。','把節日願望寫好，這回還有活動可以期待。','雪花和好消息，這次一起飄進遊戲裡。','節日的燈一亮，就想邀你來熱鬧一下。','禮物盒先別急著拆，活動精彩的還在後面。','冷冷的天氣，最適合用一場活動暖場。','這個節日，想替你的遊戲清單添一點亮光。','聖誕氣氛到位，接下來就等你加入啦。']},
 {match:/新年|春節|過年|元旦/,icon:'🧧',cue:'新年',scenes:['新的一頁打開了，先放進一件值得期待的事。','年味一到，好消息也跟著來敲門。','新年願望可以慢慢許，這場活動先收進行事曆。','把新年的第一份期待，留給今天的活動消息。','新的開始，當然要有一點新的驚喜。','喜氣還在，冒險的邀請已經送達。','今年的遊戲清單，想從一場熱鬧活動開始。','迎接新年，也替自己的角色添一點好運。']},
 {match:/黑市|市集|商店/,icon:'🛍️',cue:'尋寶',scenes:['今天的逛街路線，要不要加一站黑市？','先別急著滑走，這次的好東西值得停下來看。','尋寶雷達響了，新的活動情報已經出現。','逛一圈之前，先把這次活動的重點收好。','黑市的門打開了，驚喜藏在哪裡呢？','心願清單先拿出來，新的消息值得留意。','這次的好物情報，已經悄悄上架。','想尋寶的心情，今天可以正式開機了。']},
 {match:/武器|槍械|裝備/,icon:'⚔️',cue:'裝備',scenes:['裝備欄空出位置了嗎？新的活動情報來了。','出發前先檢查裝備，這次的重點可別漏看。','武器控的雷達，這回可以亮起來了。','一場新挑戰，從整理裝備開始。','準星先對好，今天有件事值得注意。','想替下一場戰鬥加點變化？先看看這次活動。','新裝備的話題，總讓人忍不住多看兩眼。','戰局還沒開始，期待值已經先拉滿。']},
 {match:/角色|女神|英雄/,icon:'💫',cue:'角色',scenes:['這次的主角，會不會剛好是你期待的那一位？','角色故事翻到新的一頁，活動也跟著登場。','有些角色一出現，就讓人想多停留一下。','今天想聊聊一位值得你留意的主角。','隊伍裡的位置，先幫新消息留一格。','從角色亮相開始，這次就有了不一樣的期待。','你的心動角色清單，要不要再打開看看？','新角色的話題，總是讓冒險多了一點想像。']},
 {match:/登入|簽到/,icon:'📅',cue:'簽到',scenes:['打開遊戲的那一刻，今天多了一個小期待。','每日報到的小習慣，這次也有活動陪你。','行事曆先畫個圈，別讓這次的消息溜走。','每天登入的時光，想添一點新的驚喜。','今天也來簽到嗎？先看看這場活動。','把日常的遊戲時間，變成值得期待的片刻。','一點一滴的參與，也可以很有儀式感。','打開遊戲前，先收下今天的活動情報。']},
 {match:/留言|互動|分享/,icon:'💬',cue:'互動',scenes:['留言區先留一個位置，這次想聽聽你的故事。','有些快樂，說出來就會更熱鬧。','這次的話題，想邀你一起接下去。','把想說的話準備好，活動正在等你加入。','你的那句話，說不定就是這場活動最可愛的部分。','別只讓好消息停在畫面上，來一起聊聊吧。','這場活動的熱鬧，想從你的回應開始。','今天的留言區，準備好迎接新故事了。']},
 {match:/序號|兌換碼|免費/,icon:'🎟️',cue:'領取',scenes:['好消息來得剛剛好，先把這次活動存起來。','小小的驚喜，也值得認真收進口袋。','看到領取消息時，手是不是已經想點進去了？','福利情報到站，這次可別匆匆滑過。','今天的遊戲清單，多了一個可以期待的項目。','先把好消息放進收藏，等等仔細看參加方式。','免費好禮的消息，總是讓人忍不住會心一笑。','有份活動情報，想請你先收好。']},
 {match:/抽獎|好禮|贈獎/,icon:'🎁',cue:'驚喜',scenes:['好禮清單打開了，這次會看到什麼驚喜？','今天的期待值，想從一份活動獎勵開始。','有些驚喜不用猜，往下看就知道。','幸運的故事，或許就從這場活動開始。','把好運許願清單拿出來，這次有新消息。','禮物還沒到手，期待已經先滿格了。','這次的好禮，想邀你一起來看看。','拆禮物的心情，現在就可以先準備好。']}
];
function themeFor(name){return themes.find(x=>x.match.test(name))||{icon:'✨',cue:'活動名稱',scenes:[`「${name}」這幾個字，已經讓人想知道接下來會發生什麼。`,`把「${name}」寫進今天的期待清單。`,`看到「${name}」，你腦中浮現的第一個畫面是什麼？`,`今天的遊戲情報，從「${name}」開始說起。`,`這一回，讓「${name}」替遊戲日常加點新鮮感。`,`先別急著滑走，「${name}」還有精彩的內容等你看。`,`如果今天要挑一件值得關注的事，就從「${name}」開始。`,`「${name}」登場，這次想邀你一起參與。`]};}
const at=(list,index)=>list[((index%list.length)+list.length)%list.length];
export function generateDrafts(a,s,iteration=0,recentOpenings=[]){
 const error=validateActivity(a);if(error)throw Error(error);
 const v=analyzeExamples(s.examples);
 const calm=s.tone==='沉穩';
 const scene=themeFor(a.name);
 const icon=scene.icon;
 const heart=v.emoji.find(x=>['💕','💖','💛','🧡','✨','🌟'].includes(x))||(calm?'✨':'💛');
 const reward=a.rewards.split(/\r?\n/).map(x=>x.trim()).find(Boolean);
 const rewardHint=reward.length<=55?`「${reward}」`:'這次的活動獎勵';
 const softEnds=calm?['期待你的參與。','活動資訊整理如下，歡迎參加。','一起看看這次的活動內容。']:v.playful?['快一起來看看吧～✨','這次也別錯過唷！','來看看有什麼驚喜吧～']:['期待你一起參與！','快把活動資訊收好吧！','一起看看怎麼參加吧！'];
 const title=v.bracketTitle?`【${a.name}${icon}】`:`${icon} ${a.name}`;
 const reminder=v.reminder?'💛 小提醒：參加前記得看清楚活動方式，才不會錯過獎勵唷！':'參加前別忘了確認活動方式與時間喔！';
 const bridges=[
  `這次的「${a.name}」，獎勵清單裡還有${rewardHint}。`,
  `說到「${a.name}」，就想先讓你看看${rewardHint}。`,
  `把「${a.name}」記下來，${rewardHint}也值得放進期待清單。`,
  `往下看「${a.name}」的玩法，還有${rewardHint}等你認識。`,
  `「${a.name}」的活動內容已經準備好，${rewardHint}是其中一項獎勵。`,
  `先替「${a.name}」留一點時間，看看${rewardHint}和其他活動內容。`,
  `這回的「${a.name}」，從${rewardHint}開始就讓人想多看一眼。`,
  `想知道「${a.name}」準備了什麼？${rewardHint}先來報到。`
 ];
 const rewardStarts=[
  `獎勵清單第一眼就看見${rewardHint}，這次的「${a.name}」有點讓人期待。`,
  `${rewardHint}出現在活動獎勵裡，你會先想到誰？`,
  `先說一件讓人心動的事：這次活動列出了${rewardHint}。`,
  `看到${rewardHint}，是不是想把這回活動往下看完？`,
  `「${a.name}」的獎勵情報來了，${rewardHint}先登場。`,
  `想為遊戲日常添點驚喜嗎？這回的獎勵包含${rewardHint}。`,
  `今天先從獎勵聊起：${rewardHint}已經在清單上了。`,
  `把目光移到獎勵欄，${rewardHint}正在那裡等你發現。`
 ];
 const nameStarts=[
  `如果把「${a.name}」變成一張邀請卡，第一句想寫：一起來看看吧。`,
  `「${a.name}」這個名字，你會想到什麼畫面？`,
  `先讓「${a.name}」當今天遊戲清單的主角。`,
  `這次想邀你走進「${a.name}」的故事裡。`,
  `在「${a.name}」開始之前，先把期待偷偷加一點。`,
  `把「${a.name}」念一遍，新的活動篇章就要開始了。`,
  `今天的好消息，名字叫做「${a.name}」。`,
  `翻開這回的活動頁，標題是「${a.name}」。`
 ];
 const transitions=[
  '時間和參加方式幫你整理在下方，先來看看吧。',
  '想加入這一回？往下就是完整的活動資訊。',
  '接下來，把參加方式與活動時間一起看清楚。',
  '先收好重點，再挑一個喜歡的時間參與。',
  '活動怎麼玩、獎勵有哪些，下面一次告訴你。',
  '往下看活動說明，看看這次要怎麼加入。',
  '把行事曆準備好，活動細節就在下面。',
  '想知道玩法和時間？接著往下看就知道了。'
 ];
 const approaches=['主題情境','獎勵亮點','活動邀請'];
 const intro=approaches.map((angle,slot)=>{
  let selected;
  for(let attempt=0;attempt<64;attempt++){
   const n=(Math.max(0,Math.floor(iteration))*3+slot+attempt*3);
   const sceneLine=at(scene.scenes,n);
   const bridge=at(bridges,Math.floor(n/8)+slot*2);
   const start=slot===2?at(scene.scenes,n+3):sceneLine;
   const second=slot===0?bridge:slot===1?at(rewardStarts,n):at(nameStarts,n);
   const opening=`${start}\n\n${second}`;
   selected={opening,start,second};
   if(!recentOpenings.includes(opening))break;
  }
  const preface=v.count&&v.friendly!=='大家'&&slot===2?`${v.friendly}，`:'';
  const body=`${title}\n${preface}${selected.start}${calm?'':` ${heart}`}\n\n${selected.second}\n\n${at(transitions,iteration*3+slot)}`;
  return {title:angle,body,opening:selected.opening};
 });
 const facts=`📅 活動時間\n${a.time}\n\n🌟 活動方式\n${a.conditions}\n\n🎁 活動獎勵\n${a.rewards}`;
 const summary=v.count?`已參考 ${v.count} 篇歷史文案的${v.traits.join('、')||'開場稱呼與行文節奏'}；活動日期、獎勵和條件只取自本次輸入。`:'尚未提供歷史文案，先用親切的預設語氣；貼上案例後可再產生。';
 return intro.map(({title,body,opening},i)=>({mode:'offline',title,opening,copy:`${body}\n\n${facts}\n\n${reminder}${a.cta?.trim()?`\n${a.cta}`:''}\n${at(softEnds,iteration+i)}\n\n${composeHashtags(s)}`.trim(),styleSummary:summary,concept:`依「${a.name}」的${scene.cue}意象，提供${title}切入點。${summary} 背景由程式繪製，未呼叫 AI。原廠素材維持原樣。`}));
}
export async function generateMock(a,s){return generateDrafts(a,s)[0];}
export function contain(iw,ih,x,y,w,h){const scale=Math.min(w/iw,h/ih);return {x:x+(w-iw*scale)/2,y:y+(h-ih*scale)/2,w:iw*scale,h:ih*scale};}
