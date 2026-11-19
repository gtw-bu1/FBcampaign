// 2026-11-19 使用者第二次回報的截圖案例:
// 「寫共幾名的不是很明顯就是用抽的嗎? 你為甚麼不自己判斷一下」
//
// 四個真實案例,全部曾經被判成「未標示」。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyDelivery,
  classifyDeliveryLoose,
  normalizeNumbers,
  inheritDelivery,
  toActivityRow,
  DELIVERY
} from '../src/activity-extract.mjs';

test('案例1:只有名額「共兩名」,沒有任何抽字 → 留言就抽', () => {
  assert.equal(
    classifyDelivery('輪迴脈衝*1、全新男角巴德羅*1,共兩名'),
    DELIVERY.DRAW
  );
});

test('案例2:名額加販售附註 → 留言就抽', () => {
  assert.equal(
    classifyDelivery('輪迴脈衝*1、全新女角*1（5/14販售）,共兩名'),
    DELIVERY.DRAW
  );
});

test('案例3:全角數字「＊１名」 → 留言就抽', () => {
  assert.equal(
    classifyDelivery('拳皇鬥士－伊莎貝拉 (永久)＋碧藍羽翼 (永久)＊１名'),
    DELIVERY.DRAW
  );
});

test('標題「梗圖創作抽好禮」用寬鬆規則也認得', () => {
  assert.equal(classifyDeliveryLoose('【在CSO歡慶母親節】梗圖創作抽好禮!'), DELIVERY.DRAW);
  assert.equal(classifyDeliveryLoose('【玩災厄9-3,抽出新角色】'), DELIVERY.DRAW);
});

test('先到先得的「前100名」不算抽', () => {
  assert.equal(classifyDelivery('前 100 名留言的玩家獲得 解碼器 x1'), DELIVERY.GIVE);
  assert.equal(classifyDelivery('限量 50 名'), DELIVERY.UNKNOWN);
});

test('遊戲裡的抽卡詞不會被寬鬆規則誤判', () => {
  assert.equal(classifyDeliveryLoose('史詩解碼器*5 可用於抽卡'), DELIVERY.UNKNOWN);
});

test('每帳號限領 1 次是「次」不是名額,仍判留言就送', () => {
  assert.equal(classifyDelivery('參與活動即可獲得活動解碼器 ×3（每帳號限領 1 次）'), DELIVERY.GIVE);
});

test('數字正規化:全角與中文都轉成半角', () => {
  assert.equal(normalizeNumbers('＊１名'), '*1名'.replace('*', '＊'));
  assert.equal(normalizeNumbers('共兩名'), '共2名');
  assert.equal(normalizeNumbers('共十名'), '共10名');
  // 獎勵名稱裡的中文數字不可被動到
  assert.equal(normalizeNumbers('三星武器箱'), '三星武器箱');
});

test('案例4:同則前兩行已標示,第三行未標示 → 繼承', () => {
  const items = [
    { name: '【超A級解碼器】*5', delivery: DELIVERY.DRAW },
    { name: '【超A級解碼器】*5', delivery: DELIVERY.DRAW },
    { name: '【超A級解碼器】*10', delivery: DELIVERY.UNKNOWN }
  ];
  assert.deepEqual(
    inheritDelivery(items).map((i) => i.delivery),
    [DELIVERY.DRAW, DELIVERY.DRAW, DELIVERY.DRAW]
  );
});

test('同則同時有抽與送時,未標示的不亂猜', () => {
  const items = [
    { delivery: DELIVERY.DRAW },
    { delivery: DELIVERY.GIVE },
    { delivery: DELIVERY.UNKNOWN }
  ];
  assert.equal(inheritDelivery(items)[2].delivery, DELIVERY.UNKNOWN);
});

test('整則:共兩名的貼文走完 toActivityRow 不會是未標示,名稱也不留「共兩名」', () => {
  const post = {
    id: '1_1',
    createdTime: '2025-05-21T10:00:00+0800',
    message: [
      '【渲染改善體驗活動】☀ 瘋狗怪醫要你快上線!',
      '活動獎勵',
      '輪迴脈衝*1、全新男角巴德羅*1,共兩名',
      '活動時間:5/21~5/28'
    ].join('\n'),
    comments: 72
  };
  const row = toActivityRow(post);
  assert.equal(row.delivery, DELIVERY.DRAW);
  assert.equal(row.rewards[0].name, '輪迴脈衝*1、全新男角巴德羅*1');
  assert.equal(row.comments, 72);
});

test('整則:全角名額 + 標題有抽,兩行都判得出來', () => {
  const post = {
    id: '1_2',
    createdTime: '2025-02-19T10:00:00+0800',
    message: [
      '【玩災厄9-3,抽出新角色🥳】',
      '活動獎勵',
      '拳皇鬥士－伊莎貝拉 (永久)＋碧藍羽翼 (永久)＊１名',
      '萬眾矚目－玲玲 (永久)＋碧藍羽翼 (永久)＊１名'
    ].join('\n'),
    comments: 166
  };
  const row = toActivityRow(post);
  assert.equal(row.delivery, DELIVERY.DRAW);
  assert.equal(row.rewards.length, 2);
  for (const r of row.rewards) assert.equal(r.delivery, DELIVERY.DRAW);
});
