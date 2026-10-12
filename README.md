# AI 社群圖文生成器（GitHub → Vercel 版）

這是已推送到 [gtw-bu1/FBcampaign](https://github.com/gtw-bu1/FBcampaign) 的 React／Vite 網站。Vercel 會執行 `npm run build` 並發布 `dist`。目前文案是**模擬生成**，尚未接通付費 AI 服務，也不需要 API Key。

## 發布流程

1. 在 Vercel 選 **Add New → Project → Import Git Repository**，選 [gtw-bu1/FBcampaign](https://github.com/gtw-bu1/FBcampaign)。
2. Framework 選 Vite；建置指令 `npm run build`；輸出目錄 `dist`；Root Directory 留空或選專案根目錄。
3. 按 Deploy。之後每次推送到 `main`，Vercel 會重新建置。這個 GitHub 專案目前是公開的；網站的存取權仍由 Vercel 專案設定決定。

## 本機驗證

需要 Node.js 22 以上。執行 `npm ci`、`npm test`、`npm run build`。本機預覽可執行 `npm run dev`。

## 功能與限制

- 填活動名稱、時間、獎勵與條件；上傳最多 8 張 PNG／JPG／WebP 原廠素材，標註角色、道具、獎勵 ICON 或 Logo。
- 原廠素材保留原始檔案，只在輸出 Canvas 以完整等比例方式縮放；不傳給 AI、不重繪、不套濾鏡。
- 編輯與複製社群文案，下載 1200×1200 或 1200×628 PNG。圖片上的標題與 CTA 可另外編輯。
- 可匯入／匯出 JSON 風格規則，也可加入歷史 FB 文案與參考圖。這些參考目前**不會自動供 AI 分析**；瀏覽器重新整理後，尚未匯出的資料會清除。
- 目前的背景由程式繪製、文案由規則範本產生。正式 AI 串接需新增伺服器端 API；API Key 應設在 Vercel Environment Variables，不能放在 `VITE_` 變數或前端原始碼。原廠圖檔應留在前端合成流程，不送給 AI 模型。

本版本沒有登入、雲端儲存或 FB 自動發文。若將來要讓多位同事保存活動與素材，需要額外加入權限和資料庫。

