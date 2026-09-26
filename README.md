# 盲猜21點

教會破冰用嘅兩隊估分遊戲。一部電腦投映，兩隊用手機加入同一間房。

真實答案**唔會**出現喺投映，亦唔會出現喺估緊嗰隊部手機。估完之後，答案只會喺對手手機全螢幕顯示大約 3 秒，之後留喺「對手真實分數」度。完場先一齊揭曉。

呢個唔係賭場 app，亦冇聊天室、冇單人模式。

## 點玩

1. 每人頭兩張一定要估，而且呢四張都係 1 星題。未估完唔可以停牌。
2. 之後先會抽到 2 星同 3 星。1 星同 3 星唔會連續出現。星級會顯示出嚟，睇到先決定要牌定停牌。
3. 輪到你哋時，面對面傾掂，先輸入 1 到 10。
4. 由第 3 張開始，見到新題同星級，可以「要牌」或者「停牌」。停牌係拒絕張題，張題會交畀另一隊。
5. 兩隊都停牌，或者題目用完，就揭曉。
6. 實際總分超過 21 算爆。未爆嘅一隊，分數高啲（接近 21）就贏。兩隊都爆就當平手。
7. 開波前，投映可以揀模式。模式一估完就見到對手實際分數。模式二要完場先知道，難度高啲。

## 本地試玩

要開 WebSocket，所以用 Vite 連住 Cloudflare 本地 Workers（唔好淨係開靜態頁）。

```bash
cd ~/Desktop/專案/blind-jack
npm install
npm run dev
```

瀏覽器開終端機顯示嗰個地址，預設係 `http://localhost:5173`。

1. 開三個視窗。
2. 第一個視窗撳「開新房」，再撳「我開投映（大螢幕）」。
3. 第二個視窗入同一個房號，撳「加入紅隊」。
4. 第三個視窗加入藍隊。
5. 返去投映撳「用而家題庫開局」。

### 手機同電腦同一個 Wi-Fi

如果投映用 `localhost` 開，手機掃碼會入唔到。請用終端機入面嘅 Network 地址開投映，例如 `http://192.168.1.20:5173`。二維碼會跟住呢個地址。

## 主持現場點開

1. 電腦開網址，寫暱稱，撳「開新房」。
2. 撳「我開投映（大螢幕）」，投到螢幕或者牆。
3. 兩隊隊長用手機掃二維碼。每人寫暱稱，紅隊撳「加入紅隊」，藍隊撳「加入藍隊」。同一隊可以有幾部手機，佢哋睇到同一啲對手分數。
4. 一部手機只入一隊。開咗波就唔可以轉隊。
5. 投映撳「用而家題庫開局」。
6. 輪到邊隊，嗰隊就傾計，再喺手機入估計。
7. 真實答案會喺**對手**手機彈出嚟。投映只會寫「真實答案已送到對手手機」。
8. 完場之後，投映同兩隊手機先一齊見到實際分數。要再玩就撳「再開一局」。

題目可以喺 `/admin` 改。預設密碼係 `icebreak`。

## 題庫

第一次有人開題庫或者開波，會載入內置 12 題。你可以加、改、刪、匯入同匯出 JSON。如果題庫被清空，開波會再用內置後備題。

每題格式：

```json
{ "question": "四福音有幾卷？", "answer": 4, "category": "聖經" }
```

`answer` 一定要係 1 到 10 嘅整數。

## 放到 Cloudflare

遊戲同網頁係同一個 Worker。投映、手機、WebSocket 同一個網址，教會場地少一步設定。

設定檔係 `wrangler.jsonc`（而家 Cloudflare 用呢個格式，內容等同舊嘅 `wrangler.toml`）。

1. 登入：

```bash
npx wrangler login
```

2. 部署：

```bash
npm run deploy
```

3. 改主持密碼（正式環境唔好繼續用預設密碼）：

```bash
npx wrangler secret put ADMIN_PASSWORD
```

跟住輸入新密碼。秘密值會蓋過 `wrangler.jsonc` 入面嘅預設 `icebreak`。

4. 部署完，終端機會印一個 `*.workers.dev` 網址。主持用嗰個網址開投映，手機掃上面嘅二維碼。

帳號已經寫死喺 `wrangler.jsonc` 嘅 `account_id`，會去 `ymtwill@gmail.com` 嗰個 Cloudflare 帳號。

## 放到 GitHub

```bash
cd ~/Desktop/專案/blind-jack
git init
git add .
git commit -m "開始盲猜21點"
gh repo create blind-jack --source=. --public --push
```

之後可以喺 Cloudflare Workers Builds 連呢個 repo，建置指令用 `npm run build`，部署指令用 `npx wrangler deploy`。

## 開發

```bash
npm test          # 規則同「邊個睇到答案」測試
npm run check     # TypeScript
npm run dev       # 本地房，WebSocket 用 Workers 運行時
```

每間房係一個 Durable Object。題庫係另一個 Durable Object，名叫 `QUESTION_BANK`。伺服器每次廣播之前都會用 `projectView()` 拆三份畫面：投映、紅隊、藍隊。估緊嗰隊同投映，完場之前收唔到自己嘅實際分數。
