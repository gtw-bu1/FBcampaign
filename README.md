# AI 社群圖文生成器（GitHub → Vercel 版）

這是 [gtw-bu1/FBcampaign](https://github.com/gtw-bu1/FBcampaign) 的 React／Vite 網站。Vercel 執行 `npm run build`，發布 `dist`。沒有 API Key 也能按「依案例產生文案草稿」：網站會提供三種有情境鋪陳的開場，並參考歷史 FB 文案的活動標題、親近邀請、貼心提醒與口語句尾。活動事實只取自本次輸入。這是瀏覽器內的規則式草稿，沒有呼叫 AI。`api/generate.js` 的 AI 功能預留於「稍後啟用」區塊。

## 發布流程

1. 在 Vercel 選 **Add New → Project → Import Git Repository**，選 [gtw-bu1/FBcampaign](https://github.com/gtw-bu1/FBcampaign)。
2. Framework 選 Vite；建置指令 `npm run build`；輸出目錄 `dist`；Root Directory 留空或選專案根目錄。
3. 按 Deploy。之後每次推送到 `main`，Vercel 會重新建置。這個 GitHub 專案目前是公開的；網站的存取權仍由 Vercel 專案設定決定。

## 啟用 AI

1. 在 [OpenAI API 平台](https://platform.openai.com/api-keys) 建立可用的 API Key，確認帳戶有圖片模型 `gpt-image-2.5-flare` 的使用權及額度。生成圖片與文字會產生 API 費用。
2. 到 **Vercel 專案 → Settings → Environment Variables**，新增 `OPENAI_API_KEY`（你的 API Key）與 `FB_CAMPAIGN_ACCESS_CODE`（自行產生、至少 24 字元的高強度使用密碼）。兩者都設定給 Production；要測試預覽版時，也設定給 Preview。API Key 不可貼到 GitHub、網站欄位或聊天訊息中。
3. 在 Vercel 重新部署最新的 `main`，讓新環境變數生效。進入網站後，在「使用密碼」輸入 `FB_CAMPAIGN_ACCESS_CODE`，再按「AI 生成背景與文案」。密碼只保留在當前頁面的記憶體，不儲存到瀏覽器永久空間。

API Key 只在 Vercel Function 的伺服器端使用。公開網站的生成入口要求使用密碼；未設定兩個環境變數時，API 回報未啟用，不會暗中使用模擬內容。

## 本機驗證

需要 Node.js 22 以上。執行 `npm ci`、`npm test`、`npm run build`。本機預覽可執行 `npm run dev`；若要在本機呼叫 `api/generate.js`，需用 `vercel dev` 並在本機環境中設定上述變數。不要提交 `.env` 或 `.env.local`。

## 功能與限制

- 填活動名稱、時間、獎勵與條件；上傳最多 8 張 PNG／JPG／WebP 原廠素材，標註角色、道具、獎勵 ICON 或 Logo。
- 原廠素材保留原始檔案，只在輸出 Canvas 以完整等比例方式縮放；不傳給 AI、不重繪、不套濾鏡。
- 編輯與複製社群文案，下載 1200×1200 或 1200×628 PNG。圖片上的標題與 CTA 可另外編輯。
- 每篇固定附上 `#CSO絕對武力`；八個預設活動標籤可勾選，也可加自訂 Hashtags。重複標籤只輸出一次，勾選狀態會和 FB 文案一起保存在同一個瀏覽器。
- 離線文案草稿會參考最多 20 篇歷史文案的表面語氣特徵，不複製舊活動事實。若將來啟用 AI，活動文字、風格設定、最多三篇歷史文案可送至伺服器產生宣傳開頭與無文字背景；活動時間、獎勵與條件由程式原樣放入文案。原廠圖片及 FB 參考圖不傳給 AI。
- 可匯入／匯出 JSON 風格規則，也可加入歷史 FB 文案與參考圖。歷史文字與尚未保存成案例的貼文會自動存在同一個瀏覽器、同一個網站網域的本機儲存區；再次開啟不必重貼。換裝置、使用另一個部署網址或清除瀏覽器資料時不會同步，請匯出 JSON 備份。參考圖與原廠素材重新整理後會清除。
- AI 背景選用 `gpt-image-2.5-flare`、文字選用 `gpt-4.1-mini`。前端將背景、原廠圖、圖片文字和 CTA 合成 PNG。圖片模型仍可能在背景產生非預期圖案；發布前請人工檢查。

本版本沒有登入、雲端儲存或 FB 自動發文。若將來要讓多位同事保存活動與素材，需要額外加入權限和資料庫。
