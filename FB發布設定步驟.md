# 一鍵發布到 FB — Meta 後台設定步驟

照這份做完,把三個值填進 Vercel,「發布到 FB」按鈕就會通。
**你們是自己內部用、發到自己的粉絲專頁,所以不用送審、不用商家驗證。**

---

## 先搞清楚三件事(查證過的規格)

| 事情 | 結論 | 出處 |
|---|---|---|
| 能不能發到**粉絲專頁** | ✅ 可以 | [Pages API / 貼文](https://developers.facebook.com/docs/pages-api/posts/) |
| 能不能發到**個人頁面** | ❌ 不行。`publish_actions` 已於 2018-04-24 移除,第三方 App 無法發文到個人檔案 | [Platform Product Changes](https://developers.facebook.com/ads/blog/post/v2/2018/04/24/platform-product-changes/) |
| 要不要**送審** | 只給「具備應用程式角色的人」使用 → 走**一般存取權限**,自動獲准,免送審免商家驗證 | [存取權限層級](https://developers.facebook.com/docs/graph-api/overview/access-levels/) |

**排程發文也支援**,但 Facebook 規定發布時間必須在**送出後 10 分鐘到 30 天之間**。

---

## 步驟

### 第 1 步:建立 Meta 應用程式

1. 到 <https://developers.facebook.com/apps/> → **建立應用程式**
2. 用途選 **商家(Business)**
3. 名稱隨意,例如 `好感製作所 社群發布`
4. 建好後進入應用程式主控板

### 第 2 步:加入「粉絲專頁 API」使用案例

1. 主控板左側 → **使用案例(Use cases)**
2. 找到 **Pages API / 粉絲專頁 API** → **新增**
3. 進入該使用案例的**權限**頁,確認下列四個權限都在、且層級是 **一般存取權限(Standard Access)**:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_manage_engagement`
   - `pages_read_user_engagement`

> `pages_manage_posts` 不能單獨要求,它會連帶需要 `pages_read_engagement` 與 `pages_show_list`,
> 後台通常會自動帶上。

### 第 3 步:把會用這個工具的人加進應用程式角色

**這一步是免送審的關鍵。** 一般存取權限只對「有應用程式角色的人」有效。

1. 主控板 → **應用程式角色(App roles)** → **新增人員**
2. 把自己(以及任何會按發布按鈕的同事)加為 **管理員** 或 **測試人員**
3. 被加的人要去 <https://developers.facebook.com/requests/> 接受邀請

### 第 4 步:取得粉絲專頁存取權杖

**兩種做法,建議用 B。**

**A. 快速測試用(會過期)**

1. 到 <https://developers.facebook.com/tools/explorer/>
2. 右上選你的應用程式
3. **User or Page** 選 **Get Page Access Token**,授權時勾選你的粉絲專頁
4. 權限欄位加上第 2 步那四個權限,按 **Generate Access Token**
5. 複製權杖

這種權杖大約一兩個月就過期,過期後按鈕會回報「權杖已失效或過期」。適合先驗證能不能通。

**B. 正式用(不會過期,建議)**

1. 到 <https://business.facebook.com/> → **企業設定**
2. **使用者 → 系統使用者** → 新增系統使用者(角色給管理員)
3. **指派資產** → 選你的**粉絲專頁** → 權限開 **管理粉絲專頁(完全控制)**
4. 點 **產生新權杖** → 選你的應用程式 → 勾選第 2 步那四個權限
5. 複製權杖(**只會顯示一次,立刻存好**)

系統使用者權杖不綁個人帳號,人員離職或改密碼都不會失效。

### 第 5 步:取得粉絲專頁編號

粉絲專頁 → **關於** → 頁面底部的「粉絲專頁編號」,
或在 Graph API Explorer 打 `GET /me?fields=id,name`(用粉絲專頁權杖)。

### 第 6 步:填進 Vercel

Vercel → 這個專案 → **Settings → Environment Variables**,新增兩個:

| 變數名 | 值 |
|---|---|
| `FB_PAGE_ID` | 第 5 步的粉絲專頁編號 |
| `FB_PAGE_ACCESS_TOKEN` | 第 4 步的權杖 |

(`FB_CAMPAIGN_ACCESS_CODE` 沿用現有的,不用改。)

**存完要重新部署一次**,環境變數才會生效。

---

## 驗收方式

1. 開工具,生成一組圖文
2. 按 **⇪ 發布到 FB**,會先跳確認視窗(避免手滑直接公開)
3. 成功會在通知列顯示貼文網址;點開應該就是粉絲專頁上的新貼文

### 看到錯誤怎麼對

| 訊息 | 原因 |
|---|---|
| 尚未啟用 FB 發布 | `FB_PAGE_ID` 或 `FB_PAGE_ACCESS_TOKEN` 沒設,或設完沒重新部署 |
| 使用密碼不正確 | 工具本身的使用密碼,跟 FB 無關 |
| 權杖已失效或過期 | 用了 A 方案的短期權杖,重新產生或改用 B 方案 |
| 權限不足 | 權杖少了 `pages_manage_posts`,或這個人在該專頁沒有 CREATE_CONTENT 權限 |
| 此專頁暫時被限制發文 | Meta 對該專頁有限制,要去專頁的「品質」頁看原因 |

---

## 目前實作到哪

已完成並通過測試(`npm test`,共 57 項):

- `api/post-to-facebook.js` — 發布端點。有圖走 `/{page_id}/photos`(multipart 直接傳位元組,
  不需要圖片先有公開網址),純文字走 `/{page_id}/feed`。支援排程(含 10 分鐘～30 天的範圍檢查)。
- `api/_auth.mjs` — 沿用現有的使用密碼驗證,與 `generate.js` 同一道門。
- `src/schedule.mjs` — 排程時間換算與前端驗證(本地時間 ↔ UNIX 秒、min/max 邊界)。
- `src/main.jsx` — 下載按鈕旁多一顆 **⇪ 發布到 FB**,旁邊有 **排程發布** 勾選框與時間輸入;
  勾了會變成 **⏱ 排程發布到 FB**,確認視窗會顯示排程時間。
- `vercel.json` — 登記新函式。

**第一次測試建議用排程**:勾「排程發布」選 30 分鐘後(預設值),送出後貼文不會公開,
去粉絲專頁的「排程貼文」看長相正確再取消,不會動到正式頻道。

**還沒做的:**

- 發布紀錄(目前發完只顯示網址,沒有存下來)
- 真實發布測試 — **我沒有權杖,所以從來沒有真的打到 Facebook 過**。
  上面的流程是照官方文件寫的,但「實際發出一則貼文」這件事必須等你拿到權杖才能驗。
