// 活動成效基準表(由 toolkit 腳本產生,勿手改)
// 來源:FB Graph API + 營運人工正規化的獎勵品項。更新請重跑產生腳本。
export default {
 "generatedAt": "2026-11-20",
 "source": "Facebook Graph API published_posts，最近 24 個月共 321 則貼文；獎勵品項名稱由營運人工正規化（王牌角色→當季王牌角色、超越武器→當期超越武器等）",
 "caveats": [
  "留言數不等於活動參與人數。Facebook API 不提供參與人數，那在遊戲後台。",
  "魅力度分數 = 該則留言 ÷ 同半年非活動貼文的留言中位數，衡量「比平常熱多少倍」，不是遊戲內價值。",
  "沒有控制文案品質、廣告投放、改版時程等變數。"
 ],
 "overallMedian": 126,
 "periodBaseline": {
  "2026H2": {
   "median": 3,
   "n": 32
  },
  "2026H1": {
   "median": 2,
   "n": 73
  },
  "2025H2": {
   "median": 4,
   "n": 90
  },
  "2025H1": {
   "median": 7,
   "n": 35
  },
  "2024H2": {
   "median": 6,
   "n": 25
  }
 },
 "monthly": [
  {
   "month": 1,
   "n": 1,
   "median": 45,
   "factor": null
  },
  {
   "month": 2,
   "n": 2,
   "median": 128,
   "factor": null
  },
  {
   "month": 3,
   "n": 3,
   "median": 151,
   "factor": 1.2
  },
  {
   "month": 4,
   "n": 3,
   "median": 82,
   "factor": 0.65
  },
  {
   "month": 5,
   "n": 3,
   "median": 112,
   "factor": 0.89
  },
  {
   "month": 6,
   "n": 8,
   "median": 320,
   "factor": 2.54
  },
  {
   "month": 7,
   "n": 7,
   "median": 104,
   "factor": 0.83
  },
  {
   "month": 8,
   "n": 9,
   "median": 94,
   "factor": 0.75
  },
  {
   "month": 9,
   "n": 4,
   "median": 252,
   "factor": 2
  },
  {
   "month": 10,
   "n": 2,
   "median": 161,
   "factor": null
  },
  {
   "month": 11,
   "n": 8,
   "median": 471,
   "factor": 3.74
  },
  {
   "month": 12,
   "n": 1,
   "median": 2,
   "factor": null
  }
 ],
 "difficulty": [
  {
   "label": "只要留言",
   "n": 37,
   "median": 166,
   "p25": 99,
   "p75": 350
  },
  {
   "label": "要附截圖",
   "n": 9,
   "median": 90,
   "p25": 64,
   "p75": 112
  },
  {
   "label": "投票/按表情",
   "n": 2,
   "median": 274,
   "p25": 201,
   "p75": 346
  },
  {
   "label": "要投稿創作",
   "n": 1,
   "median": 151,
   "p25": 151,
   "p75": 151
  },
  {
   "label": "填問卷表單",
   "n": 1,
   "median": 76,
   "p25": 76,
   "p75": 76
  },
  {
   "label": "要錄影片",
   "n": 1,
   "median": 45,
   "p25": 45,
   "p75": 45
  }
 ],
 "delivery": [
  {
   "label": "留言就抽",
   "n": 33,
   "median": 114,
   "p25": 94,
   "p75": 350
  },
  {
   "label": "留言就送",
   "n": 15,
   "median": 231,
   "p25": 100,
   "p75": 344
  },
  {
   "label": "兩種都有",
   "n": 1,
   "median": 163,
   "p25": 163,
   "p75": 163
  },
  {
   "label": "未標示",
   "n": 1,
   "median": 151,
   "p25": 151,
   "p75": 151
  },
  {
   "label": "投稿票選最高",
   "n": 1,
   "median": 45,
   "p25": 45,
   "p75": 45
  }
 ],
 "items": [
  {
   "item": "超A級解碼器",
   "qty": "7",
   "posts": 1,
   "itemCount": 1,
   "median": 1731,
   "p25": 1731,
   "p75": 1731,
   "min": 1731,
   "max": 1731,
   "score": 247.3,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2025-06-11"
   ],
   "samples": [
    1731
   ],
   "grade": "樣本不足"
  },
  {
   "item": "超A級解碼器",
   "qty": "3",
   "posts": 1,
   "itemCount": 2,
   "median": 418,
   "p25": 418,
   "p75": 418,
   "min": 418,
   "max": 418,
   "score": 209,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2026-06-24"
   ],
   "samples": [
    418
   ],
   "grade": "樣本不足"
  },
  {
   "item": "限定勳章",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 418,
   "p25": 418,
   "p75": 418,
   "min": 418,
   "max": 418,
   "score": 209,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2026-06-24"
   ],
   "samples": [
    418
   ],
   "grade": "樣本不足"
  },
  {
   "item": "當季史詩武器",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 397,
   "p25": 397,
   "p75": 397,
   "min": 397,
   "max": 397,
   "score": 132.3,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2026-07-15"
   ],
   "samples": [
    397
   ],
   "grade": "樣本不足"
  },
  {
   "item": "7-11禮券200元",
   "qty": "1",
   "posts": 5,
   "itemCount": 5,
   "median": 488,
   "p25": 486,
   "p75": 501,
   "min": 455,
   "max": 502,
   "score": 122,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2025-11-11",
    "2025-11-12",
    "2025-11-13",
    "2025-11-14",
    "2025-11-15"
   ],
   "samples": [
    455,
    486,
    488,
    501,
    502
   ],
   "grade": "A"
  },
  {
   "item": "限定等待室標記",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 244,
   "p25": 244,
   "p75": 244,
   "min": 244,
   "max": 244,
   "score": 122,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2026-03-05"
   ],
   "samples": [
    244
   ],
   "grade": "樣本不足"
  },
  {
   "item": "末日解碼器",
   "qty": "3",
   "posts": 2,
   "itemCount": 2,
   "median": 232,
   "p25": 179,
   "p75": 284,
   "min": 126,
   "max": 337,
   "score": 116,
   "modes": [
    "留言就抽",
    "留言就送"
   ],
   "dates": [
    "2026-04-01",
    "2026-05-13"
   ],
   "samples": [
    126,
    337
   ],
   "grade": "樣本不足"
  },
  {
   "item": "當季末日武器",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 794,
   "p25": 794,
   "p75": 794,
   "min": 794,
   "max": 794,
   "score": 113.4,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2025-06-12"
   ],
   "samples": [
    794
   ],
   "grade": "樣本不足"
  },
  {
   "item": "Season Pass",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 222,
   "p25": 222,
   "p75": 222,
   "min": 222,
   "max": 222,
   "score": 111,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2026-06-24"
   ],
   "samples": [
    222
   ],
   "grade": "樣本不足"
  },
  {
   "item": "活動解碼器",
   "qty": "3",
   "posts": 2,
   "itemCount": 2,
   "median": 250,
   "p25": 207,
   "p75": 294,
   "min": 163,
   "max": 337,
   "score": 97,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2026-04-01",
    "2026-09-21"
   ],
   "samples": [
    163,
    337
   ],
   "grade": "樣本不足"
  },
  {
   "item": "活動解碼器",
   "qty": "10",
   "posts": 1,
   "itemCount": 1,
   "median": 231,
   "p25": 231,
   "p75": 231,
   "min": 231,
   "max": 231,
   "score": 77,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2026-08-19"
   ],
   "samples": [
    231
   ],
   "grade": "樣本不足"
  },
  {
   "item": "超A級服裝角色解碼器",
   "qty": "3",
   "posts": 2,
   "itemCount": 2,
   "median": 229,
   "p25": 169,
   "p75": 288,
   "min": 110,
   "max": 347,
   "score": 76,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2026-07-01",
    "2026-08-25"
   ],
   "samples": [
    110,
    347
   ],
   "grade": "樣本不足"
  },
  {
   "item": "活動解碼器",
   "qty": "2",
   "posts": 1,
   "itemCount": 1,
   "median": 126,
   "p25": 126,
   "p75": 126,
   "min": 126,
   "max": 126,
   "score": 63,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2026-05-13"
   ],
   "samples": [
    126
   ],
   "grade": "樣本不足"
  },
  {
   "item": "限定噴漆",
   "qty": "1",
   "posts": 2,
   "itemCount": 2,
   "median": 121,
   "p25": 105,
   "p75": 136,
   "min": 90,
   "max": 151,
   "score": 60,
   "modes": [
    "未標示",
    "留言就送"
   ],
   "dates": [
    "2026-02-11",
    "2026-03-05"
   ],
   "samples": [
    90,
    151
   ],
   "grade": "樣本不足"
  },
  {
   "item": "覺醒齒輪",
   "qty": "3",
   "posts": 1,
   "itemCount": 1,
   "median": 112,
   "p25": 112,
   "p75": 112,
   "min": 112,
   "max": 112,
   "score": 56,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2026-05-13"
   ],
   "samples": [
    112
   ],
   "grade": "樣本不足"
  },
  {
   "item": "末日解碼器",
   "qty": "5",
   "posts": 4,
   "itemCount": 4,
   "median": 220,
   "p25": 93,
   "p75": 689,
   "min": 76,
   "max": 1731,
   "score": 50,
   "modes": [
    "留言就送",
    "留言就抽"
   ],
   "dates": [
    "2025-06-04",
    "2025-06-11",
    "2025-06-18",
    "2025-09-02"
   ],
   "samples": [
    76,
    99,
    341,
    1731
   ],
   "grade": "A"
  },
  {
   "item": "當季王牌角色",
   "qty": "1",
   "posts": 8,
   "itemCount": 10,
   "median": 155,
   "p25": 113,
   "p75": 171,
   "min": 33,
   "max": 350,
   "score": 45,
   "modes": [
    "留言就抽",
    "抽獎（非留言）"
   ],
   "dates": [
    "2025-02-19",
    "2025-05-07",
    "2025-05-21",
    "2025-08-06",
    "2025-11-19",
    "2026-05-13",
    "2026-06-17",
    "2026-09-21"
   ],
   "samples": [
    33,
    72,
    126,
    146,
    163,
    166,
    185,
    350
   ],
   "grade": "B"
  },
  {
   "item": "超A級服裝角色解碼器",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 121,
   "p25": 121,
   "p75": 121,
   "min": 121,
   "max": 121,
   "score": 40.3,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2026-09-09"
   ],
   "samples": [
    121
   ],
   "grade": "樣本不足"
  },
  {
   "item": "當期超越武器",
   "qty": "1",
   "posts": 7,
   "itemCount": 8,
   "median": 146,
   "p25": 87,
   "p75": 179,
   "min": 33,
   "max": 393,
   "score": 34,
   "modes": [
    "留言就抽",
    "抽獎（非留言）"
   ],
   "dates": [
    "2025-02-19",
    "2025-05-07",
    "2025-05-21",
    "2025-09-03",
    "2025-10-29",
    "2025-11-19",
    "2026-07-08"
   ],
   "samples": [
    33,
    72,
    102,
    146,
    166,
    192,
    393
   ],
   "grade": "B"
  },
  {
   "item": "超S級解碼器",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 102,
   "p25": 102,
   "p75": 102,
   "min": 102,
   "max": 102,
   "score": 34,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2026-07-08"
   ],
   "samples": [
    102
   ],
   "grade": "樣本不足"
  },
  {
   "item": "超A服裝解碼器",
   "qty": "10",
   "posts": 1,
   "itemCount": 1,
   "median": 129,
   "p25": 129,
   "p75": 129,
   "min": 129,
   "max": 129,
   "score": 32.3,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2025-10-29"
   ],
   "samples": [
    129
   ],
   "grade": "樣本不足"
  },
  {
   "item": "災厄之章服裝選擇箱",
   "qty": "1",
   "posts": 9,
   "itemCount": 9,
   "median": 94,
   "p25": 89,
   "p75": 104,
   "min": 79,
   "max": 114,
   "score": 31.3,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2026-07-22",
    "2026-07-25",
    "2026-07-29",
    "2026-08-01",
    "2026-08-05",
    "2026-08-08",
    "2026-08-12",
    "2026-08-15",
    "2026-08-19"
   ],
   "samples": [
    79,
    84,
    89,
    94,
    94,
    94,
    104,
    105,
    114
   ],
   "grade": "C"
  },
  {
   "item": "7-11禮券",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 112,
   "p25": 112,
   "p75": 112,
   "min": 112,
   "max": 112,
   "score": 28,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2025-11-21"
   ],
   "samples": [
    112
   ],
   "grade": "樣本不足"
  },
  {
   "item": "史詩解碼器",
   "qty": "5",
   "posts": 2,
   "itemCount": 3,
   "median": 45,
   "p25": 27,
   "p75": 64,
   "min": 8,
   "max": 82,
   "score": 22,
   "modes": [
    "留言就抽",
    "留言就送"
   ],
   "dates": [
    "2025-07-25",
    "2026-04-15"
   ],
   "samples": [
    8,
    82
   ],
   "grade": "樣本不足"
  },
  {
   "item": "樂豆",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 45,
   "p25": 45,
   "p75": 45,
   "min": 45,
   "max": 45,
   "score": 6.4,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2025-01-22"
   ],
   "samples": [
    45
   ],
   "grade": "樣本不足"
  },
  {
   "item": "活動限定勳章",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 45,
   "p25": 45,
   "p75": 45,
   "min": 45,
   "max": 45,
   "score": 6.4,
   "modes": [
    "留言就送"
   ],
   "dates": [
    "2025-01-22"
   ],
   "samples": [
    45
   ],
   "grade": "樣本不足"
  },
  {
   "item": "500樂豆點",
   "qty": "1",
   "posts": 1,
   "itemCount": 1,
   "median": 45,
   "p25": 45,
   "p75": 45,
   "min": 45,
   "max": 45,
   "score": 6.4,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2025-01-22"
   ],
   "samples": [
    45
   ],
   "grade": "樣本不足"
  },
  {
   "item": "凜冬寒霜箱子",
   "qty": "10",
   "posts": 1,
   "itemCount": 1,
   "median": 45,
   "p25": 45,
   "p75": 45,
   "min": 45,
   "max": 45,
   "score": 6.4,
   "modes": [
    "留言就抽"
   ],
   "dates": [
    "2025-01-22"
   ],
   "samples": [
    45
   ],
   "grade": "樣本不足"
  },
  {
   "item": "超A級解碼器",
   "qty": "5",
   "posts": 2,
   "itemCount": 2,
   "median": 6,
   "p25": 3,
   "p75": 8,
   "min": 0,
   "max": 11,
   "score": 1,
   "modes": [
    "留言就抽",
    "直接發放"
   ],
   "dates": [
    "2025-04-16",
    "2026-08-21"
   ],
   "samples": [
    0,
    11
   ],
   "grade": "樣本不足"
  }
 ],
 "activities": [
  {
   "date": "2026-09-21",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【中秋送好禮🌕】維拉．塔莉卡陪你一起過中秋💕",
   "rewards": "活動解碼器 ×3\n維拉．塔莉卡 x1",
   "delivery": "兩種都有",
   "comments": 163,
   "reactions": 165,
   "shares": 84,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1512519720912336"
  },
  {
   "date": "2026-09-09",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【留言送解碼器】快來為心中支持的殭屍應援！",
   "rewards": "超A級服裝角色解碼器 ×1",
   "delivery": "留言就送",
   "comments": 121,
   "reactions": 108,
   "shares": 62,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1500262028804772"
  },
  {
   "date": "2026-08-25",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【18周年慶系列活動】寫下回憶送服裝角色解碼器 ×3🎁",
   "rewards": "服裝角色解碼器 ×3",
   "delivery": "留言就送",
   "comments": 110,
   "reactions": 67,
   "shares": 9,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1488917309939244"
  },
  {
   "date": "2026-08-19",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【全新殭屍登場！】留言送活動解碼器*10🎁",
   "rewards": "活動解碼器*10",
   "delivery": "留言就送",
   "comments": 231,
   "reactions": 75,
   "shares": 8,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1483677357129906"
  },
  {
   "date": "2026-08-19",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第九課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 94,
   "reactions": 39,
   "shares": 2,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1483616473802661"
  },
  {
   "date": "2026-08-15",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第八課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 84,
   "reactions": 32,
   "shares": 3,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1480128317484810"
  },
  {
   "date": "2026-08-12",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第七課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 89,
   "reactions": 51,
   "shares": 11,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1477621307735511"
  },
  {
   "date": "2026-08-08",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第六課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 105,
   "reactions": 37,
   "shares": 2,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1474144868083155"
  },
  {
   "date": "2026-08-05",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第五課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 79,
   "reactions": 37,
   "shares": 2,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1471444685019840"
  },
  {
   "date": "2026-08-01",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第四課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 94,
   "reactions": 66,
   "shares": 22,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1467965368701105"
  },
  {
   "date": "2026-07-29",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第三課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 94,
   "reactions": 62,
   "shares": 23,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1465266212304354"
  },
  {
   "date": "2026-07-25",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第二課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 114,
   "reactions": 59,
   "shares": 18,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1461924835971825"
  },
  {
   "date": "2026-07-22",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "📚【災厄學堂大問答｜第一課】",
   "rewards": "災厄之章服裝選擇箱 ×1",
   "delivery": "留言就抽",
   "comments": 104,
   "reactions": 56,
   "shares": 18,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1459440242886951"
  },
  {
   "date": "2026-07-15",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "🚨【末日遠征隊招募中】戰友要送你史詩武器🎁",
   "rewards": "永耀烈陽・熾（永久）×1",
   "delivery": "留言就抽",
   "comments": 397,
   "reactions": 196,
   "shares": 74,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1453657380131904"
  },
  {
   "date": "2026-07-08",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "🔥【測測你的西遊人格！】🔥",
   "rewards": "霜焰雙星T3(永久)*1 抽出1位 + 超S級解碼器*1 抽出10位",
   "delivery": "留言就抽",
   "comments": 102,
   "reactions": 47,
   "shares": 4,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1448076747356634"
  },
  {
   "date": "2026-07-01",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【抽獎活動】各位神槍手注意！超A級服裝角色解碼器送給你",
   "rewards": "超A級服裝角色解碼器*3",
   "delivery": "留言就送",
   "comments": 347,
   "reactions": 135,
   "shares": 56,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1441871347977174"
  },
  {
   "date": "2026-06-24",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【新角色剪影曝光】他究竟是誰？",
   "rewards": "Season Pass*1",
   "delivery": "留言就抽",
   "comments": 222,
   "reactions": 134,
   "shares": 46,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1435900031907639"
  },
  {
   "date": "2026-06-24",
   "type": "留言互動型",
   "difficulty": "投票/按表情",
   "title": "【毒氣末日的抉擇】專屬勳章送給你🎁",
   "rewards": "超A解碼器*3、勳章【毒氣淨化者】\n超A解碼器*3、勳章【生存執念體】",
   "delivery": "留言就送",
   "comments": 418,
   "reactions": 79,
   "shares": 9,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1435765938587715"
  },
  {
   "date": "2026-06-17",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【薇薇安和你慶端午】連假來送禮物啦🔥",
   "rewards": "幻夢道長－薇薇安*1",
   "delivery": "留言就抽",
   "comments": 185,
   "reactions": 83,
   "shares": 21,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1429711085859867"
  },
  {
   "date": "2026-05-13",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【末日小確幸2】末日之下，和喬露一起在末日生存吧🔥",
   "rewards": "喬露*1 (永久)\n末日解碼器*3 + 活動解碼器*2",
   "delivery": "留言就抽",
   "comments": 126,
   "reactions": 54,
   "shares": 4,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1399228835574759"
  },
  {
   "date": "2026-05-13",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【末日小確幸】分享你的覺醒系統組合，就送覺醒齒輪*3 🎁",
   "rewards": "覺醒齒輪*3",
   "delivery": "留言就送",
   "comments": 112,
   "reactions": 39,
   "shares": 3,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1399093865588256"
  },
  {
   "date": "2026-04-15",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【末日生存送好禮】史詩解碼器*5 抽抽抽🎁",
   "rewards": "史詩解碼器*5\n史詩解碼器*5",
   "delivery": "留言就抽",
   "comments": 82,
   "reactions": 86,
   "shares": 11,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1375871607910482"
  },
  {
   "date": "2026-04-01",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【清明追思送禮物】🌹 我在 CSO 最懷念的事情",
   "rewards": "末日解碼器*3 + 活動解碼器*3",
   "delivery": "留言就送",
   "comments": 337,
   "reactions": 115,
   "shares": 7,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1364757742355202"
  },
  {
   "date": "2026-03-05",
   "type": "留言互動型",
   "difficulty": "要投稿創作",
   "title": "【WBC棒球賽系列活動】專屬活動2⚾",
   "rewards": "2026馬年棒球噴漆",
   "delivery": "未標示",
   "comments": 151,
   "reactions": 71,
   "shares": 9,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1342654857898824"
  },
  {
   "date": "2026-03-05",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【WBC棒球賽系列活動】專屬活動1⚾",
   "rewards": "2026瑪年棒球等待室標誌",
   "delivery": "留言就送",
   "comments": 244,
   "reactions": 93,
   "shares": 2,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1342654551232188"
  },
  {
   "date": "2026-02-11",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【好運到】遊玩馬年史詩送好運🎁",
   "rewards": "好運綻放等待室*1",
   "delivery": "留言就送",
   "comments": 90,
   "reactions": 60,
   "shares": 0,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1324002696430707"
  },
  {
   "date": "2025-12-17",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【專屬勳章送給你】加入官方帳號吧🉐",
   "rewards": "加入官方帳號\n12/17~12/31 💥挑戰白凜邊境送勳章、解碼器",
   "delivery": "留言就送",
   "comments": 2,
   "reactions": 21,
   "shares": 2,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1279509690880008"
  },
  {
   "date": "2025-11-30",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【來跟小編比看看🔥】誰比小編還會玩！💥",
   "rewards": "獎品是711禮券200元，預計抽出兩位",
   "delivery": "留言就抽",
   "comments": 21,
   "reactions": 28,
   "shares": 0,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1266547178842926"
  },
  {
   "date": "2025-11-21",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【大會考成績單出爐🔥】 挑戰大會考抽 i17 Pro 💥",
   "rewards": "7-11禮券",
   "delivery": "留言就抽",
   "comments": 112,
   "reactions": 305,
   "shares": 73,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1259723876191923"
  },
  {
   "date": "2025-11-19",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【生存者協定專屬活動】截圖完成畫面抽新角色和新武器🎁",
   "rewards": "人魚公主·格雷西雅*1\n生物學家·艾維亞*1\n煉獄爆焰 VI*1",
   "delivery": "留言就抽",
   "comments": 146,
   "reactions": 81,
   "shares": 60,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1258030993027878"
  },
  {
   "date": "2025-11-15",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【7-11禮券大放送】橘子週年慶答題正確抽好禮📢",
   "rewards": "7-11禮券200元x1",
   "delivery": "留言就抽",
   "comments": 488,
   "reactions": 370,
   "shares": 166,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1254875000010144"
  },
  {
   "date": "2025-11-14",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【7-11禮券大放送】橘子週年慶答題正確抽好禮📢",
   "rewards": "7-11禮券200元x1",
   "delivery": "留言就抽",
   "comments": 455,
   "reactions": 344,
   "shares": 139,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1254083686755942"
  },
  {
   "date": "2025-11-13",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【7-11禮券大放送】橘子週年慶答題正確抽好禮📢",
   "rewards": "7-11禮券200元x1",
   "delivery": "留言就抽",
   "comments": 486,
   "reactions": 377,
   "shares": 153,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1253284666835844"
  },
  {
   "date": "2025-11-12",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【7-11禮券大放送】橘子週年慶答題正確抽好禮📢",
   "rewards": "7-11禮券200元x1",
   "delivery": "留言就抽",
   "comments": 502,
   "reactions": 391,
   "shares": 138,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1252483596915951"
  },
  {
   "date": "2025-11-11",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【7-11禮券大放送】橘子週年慶答題正確抽好禮📢",
   "rewards": "7-11禮券200元x1",
   "delivery": "留言就抽",
   "comments": 501,
   "reactions": 380,
   "shares": 141,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1251641763666801"
  },
  {
   "date": "2025-10-29",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【邪靈碎岩VI送給你】末日下最好用的超越武器是哪一把？🎁",
   "rewards": "邪靈碎岩VI*1",
   "delivery": "留言就抽",
   "comments": 192,
   "reactions": 75,
   "shares": 12,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1240608871436757"
  },
  {
   "date": "2025-10-29",
   "type": "留言互動型",
   "difficulty": "投票/按表情",
   "title": "【異界天賦活動】主導末日，帶走解碼器豐富物資🎁",
   "rewards": "超A服裝解碼器*10",
   "delivery": "留言就抽",
   "comments": 129,
   "reactions": 116,
   "shares": 5,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1240477808116530"
  },
  {
   "date": "2025-09-03",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【金蠍雙擊送好禮】妖刀村雨VI要送你🎁",
   "rewards": "妖刀村雨VI*1",
   "delivery": "留言就抽",
   "comments": 393,
   "reactions": 113,
   "shares": 3,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1191580033006308"
  },
  {
   "date": "2025-09-02",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【戰友的見面禮】戰友與你見面🎁",
   "rewards": "末日解碼器5個",
   "delivery": "留言就送",
   "comments": 341,
   "reactions": 104,
   "shares": 22,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1190811823083129"
  },
  {
   "date": "2025-08-06",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【震天龍炮戰友小檔案大‼️公‼️開‼️】留言抽8/6全新王牌角色🎁",
   "rewards": "8/6全新王牌角色",
   "delivery": "留言就抽",
   "comments": 350,
   "reactions": 125,
   "shares": 6,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1168748101956168"
  },
  {
   "date": "2025-07-25",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【末日物資發放６】強者帶你用滅世魔狼芬里爾在末日中生存！",
   "rewards": "史詩解碼器*5",
   "delivery": "留言就送",
   "comments": 8,
   "reactions": 22,
   "shares": 2,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1158821986282113"
  },
  {
   "date": "2025-06-18",
   "type": "留言互動型",
   "difficulty": "填問卷表單",
   "title": "【末日物資發放４】戰友募集中！💝",
   "rewards": "末日物資：5個末日解碼器",
   "delivery": "留言就送",
   "comments": 76,
   "reactions": 70,
   "shares": 2,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1129714445859534"
  },
  {
   "date": "2025-06-18",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【末日物資發放３】末日降臨！大家集合領取末日物資！📢",
   "rewards": "超A解碼器*10 \n末日解碼器*2",
   "delivery": "留言就送",
   "comments": 696,
   "reactions": 130,
   "shares": 7,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1129712362526409"
  },
  {
   "date": "2025-06-12",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【末日物資發放２】當末日降臨 你會如何求生？",
   "rewards": "[末日] 震天龍砲（永久）*1",
   "delivery": "留言就抽",
   "comments": 794,
   "reactions": 176,
   "shares": 12,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1125143286316650"
  },
  {
   "date": "2025-06-11",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【末日物資發放１】當末日降臨 未知的黑幕即將進重啟！",
   "rewards": "超A解碼器*7＋末日解碼器*5",
   "delivery": "留言就送",
   "comments": 1731,
   "reactions": 267,
   "shares": 4,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1124443436386635"
  },
  {
   "date": "2025-06-04",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "💥留下你的末日預言！就抽三位獲得【末日解碼器*5】",
   "rewards": "【末日解碼器*5】",
   "delivery": "留言就抽",
   "comments": 99,
   "reactions": 104,
   "shares": 5,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1118985890265723"
  },
  {
   "date": "2025-05-07",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【在CSO歡慶母親節】💥梗圖創作抽好禮！",
   "rewards": "輪迴脈衝*1、全新女角*1（5/14販售）",
   "delivery": "留言就抽",
   "comments": 33,
   "reactions": 55,
   "shares": 14,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1098534952310817"
  },
  {
   "date": "2025-04-16",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【小編速報】即將登場災厄速通啦！",
   "rewards": "超A解碼器*5，共發放25個超A解碼器",
   "delivery": "留言就抽",
   "comments": 11,
   "reactions": 32,
   "shares": 4,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1082096590621320"
  },
  {
   "date": "2025-03-19",
   "type": "留言互動型",
   "difficulty": "要附截圖",
   "title": "【異界天賦分享加碼抽電影票📢】",
   "rewards": "超A級解碼器*5",
   "delivery": "留言就抽",
   "comments": 64,
   "reactions": 57,
   "shares": 13,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1059237772907202"
  },
  {
   "date": "2025-02-19",
   "type": "留言互動型",
   "difficulty": "只要留言",
   "title": "【玩災厄9-3，抽出新角色🥰】",
   "rewards": "拳皇鬥士－伊莎貝拉 (永久)＋碧藍羽翼 (永久)＊１名\n萬眾矚目－玲玲 (永久)＋碧藍羽翼 (永久)＊１名",
   "delivery": "留言就抽",
   "comments": 166,
   "reactions": 133,
   "shares": 51,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1037405538423759"
  },
  {
   "date": "2025-01-22",
   "type": "留言互動型",
   "difficulty": "要錄影片",
   "title": "【神槍手懸賞中！】🎉送你樂豆+活動限定勳章😍",
   "rewards": "勳章\n2000樂豆",
   "delivery": "投稿票選最高",
   "comments": 45,
   "reactions": 3028,
   "shares": 14,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1017168027114177"
  },
  {
   "date": "2026-08-21",
   "type": "非留言型",
   "difficulty": "要投稿創作",
   "title": "18週年歡慶！你來為戰場留下專屬印記！ 💕",
   "rewards": "超A級解碼器 × 5",
   "delivery": "直接發放",
   "comments": 0,
   "reactions": 21,
   "shares": 0,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1485415970289378"
  },
  {
   "date": "2026-01-08",
   "type": "非留言型",
   "difficulty": "填問卷表單",
   "title": "【小神獸登場】競猜＋命名帶走好禮！",
   "rewards": "（抓不到，待確認）",
   "delivery": "（待確認）",
   "comments": 4,
   "reactions": 31,
   "shares": 6,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1295777592586551"
  },
  {
   "date": "2025-11-19",
   "type": "非留言型",
   "difficulty": "填問卷表單",
   "title": "【問卷角色選擇箱送給你】填問卷就領🎁",
   "rewards": "問卷角色選擇箱",
   "delivery": "直接發放",
   "comments": 1,
   "reactions": 34,
   "shares": 0,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1258033349694309"
  },
  {
   "date": "2025-06-20",
   "type": "非留言型",
   "difficulty": "填問卷表單",
   "title": "【末日物資發放５】和強者一起對抗末日！📢",
   "rewards": "[末日] 震天龍砲 永久",
   "delivery": "抽獎（非留言）",
   "comments": 7,
   "reactions": 65,
   "shares": 8,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1131387239025588"
  },
  {
   "date": "2025-05-21",
   "type": "非留言型",
   "difficulty": "要附截圖",
   "title": "【渲染改善體驗活動】💥瘋狗怪醫要你快上線！",
   "rewards": "輪迴脈衝*1、全新男角巴德羅*1",
   "delivery": "抽獎（非留言）",
   "comments": 72,
   "reactions": 67,
   "shares": 5,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1108319817998997"
  },
  {
   "date": "2025-04-16",
   "type": "非留言型",
   "difficulty": "要附截圖",
   "title": "【爭取排名拿獎勵🎁】",
   "rewards": "獎勵",
   "delivery": "抽獎（非留言）",
   "comments": 12,
   "reactions": 38,
   "shares": 7,
   "permalink": "https://www.facebook.com/1572421051588869/posts/1082270310603948"
  }
 ]
};
