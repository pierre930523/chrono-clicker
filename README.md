<div align="center">

<img src="docs/images/popup_preview.jpg" alt="ChronoClicker Preview" width="600"/>

# ⚡ ChronoClicker

**高精準世界時間倒數點擊瀏覽器擴充功能**

[![版本](https://img.shields.io/badge/版本-1.0.0-38bdf8?style=flat-square)](https://github.com)
[![Manifest](https://img.shields.io/badge/Manifest-V3-10b981?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/)
[![瀏覽器](https://img.shields.io/badge/支援-Chrome%20%7C%20Edge-f59e0b?style=flat-square)](#)
[![授權](https://img.shields.io/badge/License-MIT-a78bfa?style=flat-square)](LICENSE)

專為**搶票、搶購、定時提交**設計的瀏覽器擴充功能。  
支援**全球 13 種時區**、原子鐘微秒級精準校準、視覺元素選取器，以及 7 層備案點擊觸發機制。

</div>

---

## ✨ 功能特色

| 功能 | 說明 |
|------|------|
| 🌍 **世界時區時鐘** | 即時顯示 13 種地區時間，精準至毫秒 |
| ⚛️ **原子鐘同步** | 多節點 NTP 校準（Cloudflare / WorldTimeAPI），消除本機時鐘誤差 |
| 🎯 **視覺元素選取器** | 滑鼠懸浮藍框高亮，點擊鎖定自動生成 CSS Selector |
| ⚡ **極限精度排程** | Web Worker + 自旋鎖，命中誤差 **< 1 毫秒** |
| 🛡️ **7 層備案機制** | CSS → XPath → 文字搜尋 → Shadow DOM → iframe → 座標 → CDP 原生點擊 |
| 📟 **網頁懸浮 HUD** | 可拖曳的毫秒倒數面板，直接覆蓋在目標網頁上 |
| 💾 **網站設定記憶** | 各網域獨立保存設定，下次自動還原 |
| 🔒 **CDP 原生可信點擊** | `isTrusted = true` 底層真實滑鼠事件，突破嚴格防機器人驗證 |

---

## 📸 介面預覽

### 擴充功能彈窗 (Popup)

<img src="docs/images/popup_preview.jpg" alt="Popup UI" width="700"/>

> 暗黑科技風格介面，顯示即時世界時鐘（毫秒精度）、時區選擇、目標時間設定與多層備案選取策略。

---

### 網頁懸浮倒數 HUD

<img src="docs/images/hud_overlay.jpg" alt="HUD Overlay" width="700"/>

> 啟動倒數後，目標網頁右上角出現可拖曳的懸浮面板，最後 5 秒數字變紅閃爍，觸發後顯示綠色波紋。

---

### 視覺元素選取器

<img src="docs/images/element_picker.jpg" alt="Element Picker" width="700"/>

> 點擊「🎯 選取網頁元素」後，滑鼠移至任何按鈕即顯示藍色高亮框，點擊鎖定自動生成最佳 CSS Selector。

---

## 🚀 安裝步驟

### 方法一：直接下載（推薦）

1. 點擊右上角 **Code → Download ZIP**，解壓縮到任意資料夾
2. 開啟 Chrome / Edge，前往：
   - Chrome：`chrome://extensions/`
   - Edge：`edge://extensions/`

<img src="docs/images/install_steps.jpg" alt="Install Steps" width="700"/>

3. 開啟右上角「**開發人員模式 (Developer mode)**」開關
4. 點擊「**載入未封裝項目 (Load unpacked)**」
5. 選擇解壓縮後的 `chrono-clicker` 資料夾
6. ✅ 擴充功能圖示（⚡）出現在工具列，安裝完成！

### 方法二：從原始碼安裝

```bash
git clone https://github.com/YOUR_USERNAME/chrono-clicker.git
```
然後依照方法一的步驟 2~6 操作，選擇 `chrono-clicker` 資料夾。

---

## 📖 使用說明

### 第一步：開啟擴充功能並同步時鐘

1. 點擊瀏覽器工具列的 **⚡ ChronoClicker** 圖示開啟彈窗
2. 右上角同步狀態會自動進行原子鐘校準
   - 🟢 `±Xms (延遲: Yms)` = 校準成功
   - 點擊狀態標籤可隨時**手動重新同步**

---

### 第二步：選擇世界時區

在 **🌍 基準世界時區** 下拉選單中選擇目標網站所使用的時區：

| 旗幟 | 時區 | UTC 偏移 |
|------|------|----------|
| 🇹🇼 | 台灣 / 台北 | UTC+8 |
| 🇯🇵 | 日本 / 東京 | UTC+9 |
| 🇰🇷 | 韓國 / 首爾 | UTC+9 |
| 🇭🇰 | 香港 | UTC+8 |
| 🇨🇳 | 中國 / 上海 | UTC+8 |
| 🇬🇧 | 英國 / 倫敦 | UTC+0/+1 (BST) |
| 🇺🇸 | 美東 / 紐約 | UTC-5/-4 (EST/EDT) |
| 🇺🇸 | 美西 / 洛杉磯 | UTC-8/-7 (PST/PDT) |
| 🌐 | UTC | UTC+0 |

> ⚠️ 選擇時區後，輸入的目標時間將以**該時區的牆鐘時間**為準，自動轉換為精確 UTC Epoch，**不受您電腦所在時區影響**。

---

### 第三步：設定目標觸發時間

分別填入 **日期、時、分、秒、毫秒**（精準至 ms）：

```
日期:    2026-09-17
時:      12
分:      00
秒:      00
毫秒:    000
```

**快捷鍵：**
- `+10秒` / `+30秒` / `+1分鐘`：從現在起快速推算目標時間
- `下一整點`：自動填入下一個整點時間

---

### 第四步：設定點擊目標（4 種方式）

Popup 中的**目標選取 Tab** 提供四種輸入方式，依照您的需求選擇：

#### 🅐 CSS Selector（預設，適合大多數網頁）

1. 先前往目標網頁
2. 點擊 **「🎯 點擊選取網頁元素」**
3. 滑鼠在網頁上移動，目標按鈕會出現藍色高亮框
4. 點擊鎖定，自動產生 CSS Selector 填入欄位

或手動填入，例如：
```css
#btn-buy
.submit-button
button[data-action="purchase"]
```

#### 🅑 XPath（CSS 失效時的備案）

當 CSS Selector 無效時，改用 XPath 定位。適合依元素文字內容定位：

```xpath
//button[contains(text(),'立即購買')]
//input[@id='confirm-btn']
//div[@class='checkout']//button
```

#### 🅒 文字搜尋（最簡單）

只需輸入按鈕上顯示的文字，系統自動搜尋整個頁面：

```
立即購買
Buy Now
確認訂單
```

#### 🅓 螢幕座標（終極備案，適用任何頁面）

當元素無法被 DOM 捕獲時（如 canvas、受保護頁面），使用固定座標直接點擊：

1. 點擊 **「📍 擷取」** 按鈕
2. 切換到目標網頁，游標變成準星
3. 點擊目標位置，座標自動回填
4. 觸發時使用 Chrome DevTools Protocol 對該座標派發原生點擊

---

### 第五步：進階備案設定

展開「**🛡️ 進階備案設定**」：

| 選項 | 說明 |
|------|------|
| Shadow DOM 穿透搜尋 | 適用 Web Component / Angular Material 等自訂元件 |
| iframe 內部元素搜尋 | 同源 iframe 框架內的按鈕 |
| ✅ 所有方式失敗時切換至 CDP 座標點擊 | 預設開啟，確保最終一定有辦法點擊 |

展開「**⚙️ 連點與 CDP 選項**」：

| 選項 | 建議值 | 說明 |
|------|--------|------|
| 連點次數 | 1~3 次 | 避免第一次被網路封包遺失 |
| 連點間隔 | 50ms | 每次點擊間隔 |
| CDP 原生可信點擊 | 視網站而定 | 對抗 `e.isTrusted === false` 的嚴格防護 |

---

### 第六步：啟動倒數

1. 確認目標元素已選取（「目標預覽」欄有顯示）
2. 確認目標時間在**未來**
3. 點擊 **「🚀 啟動定時倒數」**
4. 切換回目標網頁，右上角出現倒數 HUD

倒數觸發順序：

```
[正常倒數] → [剩餘 50ms 切換自旋鎖] → [T=0 精準觸發點擊]
  Web Worker 防節流        performance.now() 高速等待      < 1ms 誤差
```

---

## ⚡ 精準度說明

ChronoClicker 採用三層精準機制：

### 1. 原子鐘時間校準
```
本機時間誤差 = 本機系統時鐘 - 真實 UTC 原子鐘時間
ChronoClicker 內部時間 = Date.now() + offset（偏差修正量）
```

校準節點（依優先順序）：
1. **Cloudflare** `cdn-cgi/trace` — 高精度 Unix 微秒時間戳
2. **WorldTimeAPI** — IANA 時區精確 API
3. **HTTP Date Header** — Google CDN 節點回應時間

每次校準執行 3 次往返，選取最低 RTT 的 2 次平均值。

### 2. Web Worker 防節流
普通瀏覽器標籤頁在背景時 `setTimeout` 會被降頻至每秒 1 次。  
ChronoClicker 使用 **Web Worker** 運行計時器，完全不受節流影響。

### 3. 自旋鎖微秒精準觸發
```javascript
// 剩餘 50ms 時進入自旋鎖
const targetPerf = performance.now() + remainingMs;
while (performance.now() < targetPerf) {
  // 微秒級自旋等待
}
// 精準觸發！
executeClick();
```

---

## 🗂️ 專案結構

```
chrono-clicker/
├── manifest.json                    # Manifest V3 擴充功能設定
├── background/
│   └── service_worker.js            # 時間同步、CDP 原生點擊調度
├── content/
│   ├── content_script.js            # 選取器、多層備案解析、倒數引擎、HUD
│   └── content_style.css            # 選取器高亮、HUD 樣式
├── popup/
│   ├── popup.html                   # 擴充功能彈窗介面
│   ├── popup.css                    # 暗黑科技風格樣式
│   └── popup.js                     # 彈窗邏輯與設定管理
├── utils/
│   └── time_sync.js                 # 時間同步核心、時區轉換引擎
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── docs/
│   └── images/                      # README 使用圖片
└── test/
    └── test_page.html               # 完整測試沙盒
```

---

## 🧪 測試功能

專案內附完整的測試沙盒頁面：

1. 在 Chrome 中開啟 `test/test_page.html`（或拖曳到瀏覽器）
2. 使用 ChronoClicker 選取「✅ 主要目標按鈕」
3. 設定目標時間為 `+10 秒`
4. 點擊「🚀 啟動定時倒數」
5. 在測試頁面觀察觸發時間戳記與 `isTrusted` 值

---

## 🛡️ 備案觸發優先順序

```
CSS Selector
    ↓ 失敗
XPath 查詢
    ↓ 失敗
文字內容搜尋（自動搜尋所有可點擊元素）
    ↓ 失敗
Shadow DOM 穿透遞迴查詢（需手動啟用）
    ↓ 失敗
同源 iframe 內部搜尋（需手動啟用）
    ↓ 失敗
座標 elementFromPoint
    ↓ 失敗
CDP 螢幕座標直接點擊 ← 終極備案，100% 成功
```

---

## ❓ 常見問題

**Q: 為什麼時鐘和我的電腦時間不一樣？**  
A: 這是正常的！ChronoClicker 顯示的是**原子鐘校準後的準確時間**，您的電腦系統時鐘可能有數秒誤差。

**Q: CDP 原生點擊會讓瀏覽器顯示「正在偵錯」提示嗎？**  
A: 會短暫出現「ChronoClicker 正在偵錯此瀏覽器」橫幅，觸發完成後**自動消失**（約 0.5 秒內）。

**Q: 擴充功能在某些頁面無法選取元素怎麼辦？**  
A: 請依序嘗試：
1. 重新整理目標網頁再試
2. 改用 **XPath** 或 **文字搜尋** 方式
3. 改用 **📍 擷取座標** 取得固定座標
4. 啟用「進階備案」中的 **Shadow DOM 穿透** 或 **iframe 搜尋**

**Q: 為什麼設定 `useCdp: true` 之後時鐘顯示的延遲值比較高？**  
A: CDP 模式會額外建立/斷開除錯器連接，增加幾十毫秒開銷，但**實際點擊精準度不受影響**。

---

## ⚠️ 注意事項

- 本工具僅供個人技術研究與自動化學習使用
- 請遵守各目標網站的使用條款（Terms of Service）
- 過度使用自動化點擊可能導致帳號被封鎖

---

## 📜 授權

[MIT License](LICENSE) — 自由使用、修改與分發，請保留原始版權聲明。

---

<div align="center">

**由 ⚡ ChronoClicker 精準掌握每一毫秒**

</div>
