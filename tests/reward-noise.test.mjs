// 2026-11-20:實際拉了 45 則活動貼文,13 則的獎勵欄抓到說明文字或殘渣。
// 這裡的每一行都是**從粉專真實文案複製下來的**,不是我編的。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isNoiseLine,
  cleanRewardName,
  extractRewardLines,
  isCommentDriven,
  classifyDeliveryLoose,
  toActivityRow,
  DELIVERY
} from '../src/activity-extract.mjs';

test('條款與說明文字要被當雜訊丟掉', () => {
  const noise = [
    '2. 所有得獎者須於2025/12/15 23:59前回填領獎資料，請務必要留意領獎說明',
    '3. 一個Facebook帳號，只能獲得一次抽獎資格。',
    '6. 本活動獎品不得轉換、轉讓或折換現金，且主辦單位不負贈品之任何維護或保固之責任。',
    '7. 本活動贈品寄送地址只限台、澎、金、馬地區。',
    '價值未達申請機會中獎稅標準，故無需提供申報資料。',
    '在8/23 23:59前，留言處寫下你的答案！🎉',
    '📅 下一次大問答釋出日：8/19（三）',
    '準備好接受災厄考驗了嗎？',
    '讓我們一起回顧《災厄之章》的危機真相！',
    '✨活動表單：https://forms.gamania.com/s/3Zd2M',
    '，千萬別錯過囉👋',
    '猜錯沒關係， 留言就有機會帶走獎勵～'
  ];
  for (const line of noise) assert.equal(isNoiseLine(line), true, `應該丟掉:${line}`);
});

test('真的獎勵行不可以被當雜訊丟掉', () => {
  const keep = [
    '活動解碼器 ×3（每帳號限領 1 次）',
    '7-11禮券200元x1（共兩名得獎者）',       // 含「得獎者」但有數量,是真獎勵
    '2026馬年棒球噴漆🎁',                    // 沒有數量,靠獎勵詞救
    '覺醒齒輪箱1個',
    '王牌武器 Pass(1日)',
    '拳皇鬥士－伊莎貝拉 (永久)＋碧藍羽翼 (永久)＊１名',  // 全角數量
    '末日解碼器*3 + 活動解碼器*3'
  ];
  for (const line of keep) assert.equal(isNoiseLine(line), false, `不該丟:${line}`);
});

test('獎勵名稱清成只剩名稱與數量', () => {
  const cases = [
    ['就有機會抽中：災厄之章服裝選擇箱 ×1（共3名神槍手）✨', '災厄之章服裝選擇箱 ×1'],
    ['7-11禮券200元x1（共兩名得獎者）', '7-11禮券200元x1'],
    ['超A服裝角色解碼器*10（每個帳號限制獲得1次）', '超A服裝角色解碼器*10'],
    ['邪靈碎岩VI*1，抽一位獲得（11/26發放）', '邪靈碎岩VI*1'],
    ['幻夢道長－薇薇安*1（抽出1位）', '幻夢道長－薇薇安*1'],
    ['妖刀村雨VI*1 一位', '妖刀村雨VI*1'],
    ['輪迴脈衝*1、全新男角巴德羅*1，共兩名', '輪迴脈衝*1、全新男角巴德羅*1'],
    ['完成投稿的玩家皆可獲得活動獎勵超A級解碼器 × 5！🎁 （於9/16維護時發放）', '超A級解碼器 × 5'],
    ['好運綻放等待室*1🍀（3/18維護後發放）', '好運綻放等待室*1'],
    ['留言就送超A級服裝角色解碼器*3', '超A級服裝角色解碼器*3']
  ];
  for (const [input, expected] of cases) assert.equal(cleanRewardName(input), expected);
});

test('（永久）（1日）是獎勵屬性,不可以清掉', () => {
  assert.equal(cleanRewardName('永耀烈陽・熾（永久）×1'), '永耀烈陽・熾（永久）×1');
  assert.equal(cleanRewardName('王牌武器 Pass(1日)'), '王牌武器 Pass(1日)');
  assert.equal(
    cleanRewardName('霜焰雙星T3(永久)*1 抽出1位 + 超S級解碼器*1 抽出10位'),
    '霜焰雙星T3(永久)*1 抽出1位 + 超S級解碼器*1 抽出10位'
  );
});

test('整篇都是條款時,寧可回空陣列也不要塞垃圾', () => {
  const message = [
    '【大會考成績單出爐🔥】挑戰大會考抽 i17 Pro',
    '本活動獎勵價值未達申請機會中獎稅標準，故無需提供申報資料。',
    '2. 所有得獎者須於2025/12/15 23:59前回填領獎資料。',
    '3. 一個Facebook帳號，只能獲得一次抽獎資格。'
  ].join('\n');
  assert.deepEqual(extractRewardLines(message), []);
});

test('標題寫「送禮物/送好運/發放」也判得出留言就送', () => {
  assert.equal(classifyDeliveryLoose('【清明追思送禮物】🌹 我在 CSO 最懷念的事情'), DELIVERY.GIVE);
  assert.equal(classifyDeliveryLoose('【好運到】遊玩馬年史詩送好運🎁'), DELIVERY.GIVE);
  assert.equal(classifyDeliveryLoose('【末日物資發放６】強者帶你在末日中生存！'), DELIVERY.GIVE);
  // 標題同時有抽與送時,抽優先
  assert.equal(classifyDeliveryLoose('【7-11禮券大放送】橘子週年慶答題正確抽好禮📢'), DELIVERY.DRAW);
});

test('沒有要求留言的活動要標成非留言型', () => {
  assert.equal(isCommentDriven('🎉18週年慶序號大放送！輸入序號即可領取'), false);
  assert.equal(isCommentDriven('在貼文下方留言你的答案'), true);
  assert.equal(isCommentDriven('標記好友一起參加'), true);
});

test('整則:非留言型的序號文,row 會標出來', () => {
  const post = {
    id: '1_3',
    createdTime: '2026-08-29T10:00:00+0800',
    message: '🎉18週年慶序號大放送！\n活動獎勵\n覺醒齒輪箱1個\n序號請於官網兌換',
    comments: 4
  };
  const row = toActivityRow(post);
  assert.equal(row.commentDriven, false);
  assert.equal(row.rewards[0].name, '覺醒齒輪箱1個');
});
