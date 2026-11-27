# 單圖發文排程

圖文以原始圖片和文案保存在專用 Supabase 專案。資料庫每分鐘檢查到期工作，呼叫正式工具。工具只在認領工作後，使用與「立刻發布」相同的 Facebook 上傳函式。使用者可在排程清單取消尚待發布的工作。舊版已交給 Facebook 的排程繼續由 Facebook 處理。

## 啟用

1. 在專用 Supabase 專案開啟 Data API，使用 SQL Editor 執行同目錄的 `scheduled-photos.sql`。指令會安裝 `pg_cron` 和 `pg_net` 並登記每分鐘工作；回呼網址已指定為 `https://f-bcampaign.vercel.app/api/deliver-scheduled-photo`。測試環境應使用獨立資料庫和對應的回呼網址。
2. 在 Vercel 的 Production 環境設定 `FB_QUEUE_SUPABASE_URL` 為 Supabase 專案網址，`FB_QUEUE_SUPABASE_SECRET_KEY` 為該專案的後端 Secret key（`sb_secret_…`）。這兩項只供伺服器使用。既有 Facebook 權杖與工具密碼保留在 Vercel。
3. 部署這個版本。在正式工具排一筆獲准的測試，確認清單出現「工具排程 · 待發布」。到點後檢查粉專動態與貼文頁的圖文，與立刻發布的貼文比較，留下截圖後依約清理測試。

「結果待確認」表示 Facebook 呼叫失敗、回應中斷或工作沒有完成。為避免重複貼文，此狀態會保留給同仁核對。圖檔會在發布完成或轉為待確認時清除，成功紀錄保留 30 天，畫面列出最近十筆成功結果。啟用前需確認 Supabase 專案持續運作，暫停的資料庫無法在排定時間喚醒工作。

## 驗證

以 `TZ=Asia/Taipei npm test` 跑應用程式測試。可在隔離的測試資料庫執行 `tests/sql/scheduled-photos.sql` 驗證排程、單次認領、撤銷、存取權限與中斷處理。此 SQL 測試會回滾測試資料。

[Supabase Cron](https://supabase.com/docs/guides/cron/quickstart) · [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)
