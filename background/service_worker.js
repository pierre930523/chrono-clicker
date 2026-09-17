/**
 * ChronoClicker - Background Service Worker (Manifest V3)
 * 負責：
 *   1. 跨域時間同步請求與原子鐘校準
 *   2. CDP (Chrome DevTools Protocol) 真正原生 isTrusted: true 滑鼠事件調度 (具備預熱 Session 池與人體工學點擊)
 *   3. 本機系統級實體滑鼠伺服器 (Windows Win32 API) 通訊調度
 *   4. 多目標序列排程器
 *   5. AI 驗證碼辨識代理 (繞過 CORS)
 */

importScripts('../utils/time_sync.js');

// 初始化時間同步
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[ChronoClicker] Service Worker installed. Initializing time sync...');
  await TimeSync.init();
  await TimeSync.syncTime();
});

chrome.runtime.onStartup.addListener(async () => {
  await TimeSync.init();
  await TimeSync.syncTime();
});

// ─── CDP 除錯器 Session 管理中心 ──────────────────────────────────
const attachedTabs = new Set();
let isScheduleActive = false;

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source && source.tabId) {
    attachedTabs.delete(source.tabId);
    console.log(`[ChronoClicker CDP] Tab ${source.tabId} detached. Reason:`, reason);
  }
});

async function ensureDebuggerAttached(tabId) {
  if (!tabId) throw new Error('Invalid tabId for debugger');
  if (attachedTabs.has(tabId)) {
    return true;
  }
  try {
    await chrome.debugger.attach({ tabId }, '1.3');
    attachedTabs.add(tabId);
    console.log(`[ChronoClicker CDP] Successfully attached to tab ${tabId}`);
    return true;
  } catch (err) {
    if (err.message && err.message.includes('already attached')) {
      attachedTabs.add(tabId);
      return true;
    }
    throw err;
  }
}

async function detachDebugger(tabId) {
  if (!tabId || !attachedTabs.has(tabId)) return;
  try {
    await chrome.debugger.detach({ tabId });
  } catch (e) {
    // 忽略 detach 異常
  } finally {
    attachedTabs.delete(tabId);
    console.log(`[ChronoClicker CDP] Detached from tab ${tabId}`);
  }
}

// ─── 訊息處理中心 ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request;

  // 1. 時間同步
  if (action === 'SYNC_TIME') {
    TimeSync.syncTime().then((result) => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (action === 'GET_TIME_STATUS') {
    sendResponse({
      offset: TimeSync.offset,
      rtt: TimeSync.rtt,
      lastSyncTime: TimeSync.lastSyncTime,
      isSynced: TimeSync.isSynced,
      accurateNow: TimeSync.getAccurateNow()
    });
    return false;
  }

  // 2. CDP 預熱 (Pre-Attach) — 倒數開始時預先掛載，消除零秒點擊延遲
  if (action === 'PRE_ATTACH_CDP') {
    const tabId = sender.tab ? sender.tab.id : payload?.tabId;
    isScheduleActive = true;
    focusTabAndWindow(tabId).then(() => {
      return ensureDebuggerAttached(tabId);
    }).then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (action === 'DETACH_CDP') {
    const tabId = sender.tab ? sender.tab.id : payload?.tabId;
    isScheduleActive = false;
    detachDebugger(tabId)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 3. CDP 原生點擊派發
  if (action === 'DISPATCH_CDP_CLICK') {
    const tabId = sender.tab ? sender.tab.id : payload.tabId;
    const { x, y, repeat = 1, interval = 50, keepAttached = isScheduleActive } = payload;

    dispatchCdpClicks(tabId, x, y, repeat, interval, keepAttached)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 4. 系統級實體滑鼠連線服務 (Windows Hardware Mouse Server)
  if (action === 'CHECK_SYSTEM_MOUSE_STATUS') {
    checkSystemMouseServer()
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ available: false, error: err.message }));
    return true;
  }

  if (action === 'DISPATCH_SYSTEM_MOUSE_CLICK') {
    const tabId = sender.tab ? sender.tab.id : payload.tabId;
    const { screenX, screenY, physicalX, physicalY, repeat = 1, interval = 50, button = 'left' } = payload;
    focusTabAndWindow(tabId).then(() => {
      return dispatchSystemMouseClick(screenX, screenY, physicalX, physicalY, repeat, interval, button);
    }).then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 5. 轉發選取器激活命令到指定分頁
  if (action === 'START_ELEMENT_PICKER') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'ACTIVATE_PICKER' }, (res) => {
          sendResponse(res || { status: 'picker_requested' });
        });
      } else {
        sendResponse({ success: false, error: '未找到活躍分頁' });
      }
    });
    return true;
  }

  // 5.1 接收並持久化元素選取結果（解決 popup 關閉後選取資訊丟失問題）
  if (action === 'ELEMENT_PICKED') {
    const summary = payload;
    const tabUrl = sender.tab ? sender.tab.url : '';
    let domain = 'global';
    try {
      if (tabUrl) domain = new URL(tabUrl).hostname || 'global';
    } catch (e) {}

    chrome.storage.local.get([`site_${domain}`], (res) => {
      const current = res[`site_${domain}`] || {};
      const updated = {
        ...current,
        selector: summary.selector || current.selector || '',
        xpath: summary.xpath || current.xpath || '',
        searchText: summary.searchText || current.searchText || '',
        coords: summary.coords || current.coords,
        targetPreview: `${summary.tagName.toUpperCase()}${summary.id ? '#' + summary.id : ''} "${summary.text || ''}"`,
        isTicketPlus: summary.isTicketPlus || domain.includes('ticketplus.com.tw')
      };
      chrome.storage.local.set({ [`site_${domain}`]: updated }, () => {
        console.log(`[ChronoClicker SW] ✅ 已自動持久化選取元素 (${domain}):`, updated);
      });
    });
    sendResponse({ success: true });
    return false;
  }

  // 5.2 接收並持久化座標擷取結果
  if (action === 'COORD_CAPTURED') {
    const { x, y, viewportX, viewportY, screenX, screenY, physicalX, physicalY, isPageCoords } = payload;
    const tabUrl = sender.tab ? sender.tab.url : '';
    let domain = 'global';
    try {
      if (tabUrl) domain = new URL(tabUrl).hostname || 'global';
    } catch (e) {}

    chrome.storage.local.get([`site_${domain}`], (res) => {
      const current = res[`site_${domain}`] || {};
      const updated = {
        ...current,
        useCoords: true,
        coords: {
          x, y, viewportX, viewportY, screenX, screenY, physicalX, physicalY,
          isPageCoords: isPageCoords === true
        },
        targetPreview: `📍 頁面座標 (X:${x}, Y:${y})`
      };
      chrome.storage.local.set({ [`site_${domain}`]: updated }, () => {
        console.log(`[ChronoClicker SW] ✅ 已自動持久化座標 (${domain}):`, updated);
      });
    });
    sendResponse({ success: true });
    return false;
  }

  // 6. 功能 A：多目標定時排程
  if (action === 'SCHEDULE_MULTI_CLICK') {
    const { tabId, targets, targetEpoch, offset, useCdp, useSystemMouse } = payload;
    const accurateNow = Date.now() + (offset || 0);
    const delayMs = targetEpoch - accurateNow;

    if (delayMs < 0) {
      sendResponse({ success: false, error: '目標時間已過去' });
      return false;
    }

    isScheduleActive = true;

    // 將頂層的 useCdp 與 useSystemMouse 屬性灌注至每一個未自訂的子目標中
    const enrichedTargets = targets.map(t => ({
      ...t,
      useCdp: t.useCdp !== undefined ? t.useCdp : (useCdp || false),
      useSystemMouse: t.useSystemMouse !== undefined ? t.useSystemMouse : (useSystemMouse || false)
    }));

    // 若需要 CDP，提前 3 秒預先掛載除錯器
    if (useCdp || enrichedTargets.some(t => t.useCdp)) {
      const preWarmDelay = Math.max(0, delayMs - 3000);
      setTimeout(() => {
        focusTabAndWindow(tabId).then(() => {
          ensureDebuggerAttached(tabId).catch(console.warn);
        });
      }, preWarmDelay);
    }

    setTimeout(() => {
      focusTabAndWindow(tabId).then(() => {
        chrome.tabs.sendMessage(tabId, {
          action: 'EXECUTE_MULTI_CLICK',
          payload: { targets: enrichedTargets }
        }, () => {
          if (chrome.runtime.lastError) {
            console.warn('[ChronoClicker] EXECUTE_MULTI_CLICK dispatch error:', chrome.runtime.lastError.message);
          }
          // 排程執行結束後 4 秒自動分離除錯器
          setTimeout(() => {
            isScheduleActive = false;
            detachDebugger(tabId).catch(() => {});
          }, 4000);
        });
      });
    }, Math.max(0, delayMs));

    sendResponse({ success: true, scheduledIn: delayMs });
    return false;
  }

  // 7. 功能 B：CAPTCHA 頁面截圖
  if (action === 'CAPTURE_CAPTCHA_SCREENSHOT') {
    const tabId = payload.tabId;
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    });
    return true;
  }

  // 8. 功能 B：AI 驗證碼解析代理（繞過 CORS）
  if (action === 'SOLVE_CAPTCHA_AI') {
    const { model, apiKey, imageBase64, prompt } = payload;
    solveCaptchaWithAI(model, apiKey, imageBase64, prompt)
      .then(answer => sendResponse({ success: true, answer }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function focusTabAndWindow(tabId) {
  if (!tabId) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && !tab.active) {
      await chrome.tabs.update(tabId, { active: true });
    }
    if (tab && tab.windowId) {
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  } catch (e) {}
}

// ─── CDP 原生可信點擊派發核心 ──────────────────────────────────────
/**
 * 透過 chrome.debugger 派發 isTrusted === true 的真正原生滑鼠事件
 * 具有人體工學按壓停留 (30ms)、完整 buttons/pointerType 與微秒級預先掛載支援
 */
async function dispatchCdpClicks(tabId, x, y, repeat = 1, interval = 50, keepAttached = false) {
  if (!tabId) throw new Error('Invalid tabId');

  await focusTabAndWindow(tabId);
  await ensureDebuggerAttached(tabId);
  const target = { tabId };
  const rx = Math.round(x);
  const ry = Math.round(y);

  try {
    for (let i = 0; i < repeat; i++) {
      // 1. 移動游標至目標點（觸發 CSS :hover 與 JS pointerover/mouseenter）
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: rx,
        y: ry
      });

      // 2. 派發按下滑鼠左鍵（buttons: 1, pointerType: 'mouse'）
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: rx,
        y: ry,
        button: 'left',
        buttons: 1,
        clickCount: 1,
        pointerType: 'mouse'
      });

      // 3. 真實物理停留 30ms，避免極速 0ms 脈衝被防爬蟲防護判定為異常
      await new Promise(resolve => setTimeout(resolve, 30));

      // 4. 派發放開滑鼠左鍵（buttons: 0）
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: rx,
        y: ry,
        button: 'left',
        buttons: 0,
        clickCount: 1,
        pointerType: 'mouse'
      });

      if (i < repeat - 1 && interval > 0) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  } finally {
    if (!keepAttached && !isScheduleActive) {
      setTimeout(() => {
        if (!isScheduleActive) detachDebugger(tabId);
      }, 1000);
    }
  }
}

// ─── 系統級實體滑鼠連線服務 (Local Hardware Mouse Server) ──────────
const SYSTEM_MOUSE_URL = 'http://127.0.0.1:28888';

async function checkSystemMouseServer() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);
    const resp = await fetch(`${SYSTEM_MOUSE_URL}/status`, {
      method: 'GET',
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (resp.ok) {
      const data = await resp.json();
      return { available: true, info: data };
    }
    return { available: false };
  } catch (e) {
    return { available: false, error: e.message };
  }
}

async function dispatchSystemMouseClick(screenX, screenY, physicalX, physicalY, repeat = 1, interval = 50, button = 'left') {
  try {
    const body = {
      screenX: Math.round(screenX),
      screenY: Math.round(screenY),
      repeat: Math.max(1, repeat),
      interval: Math.max(10, interval),
      button: button,
      activateWindow: true
    };
    if (physicalX !== undefined && physicalX !== null) {
      body.physicalX = Math.round(physicalX);
    }
    if (physicalY !== undefined && physicalY !== null) {
      body.physicalY = Math.round(physicalY);
    }

    const resp = await fetch(`${SYSTEM_MOUSE_URL}/click`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`System mouse server error: ${errText}`);
    }

    const res = await resp.json();
    return { success: true, details: res };
  } catch (err) {
    console.warn('[ChronoClicker] System mouse click failed:', err.message);
    throw err;
  }
}

// ─── AI 驗證碼解析（功能 B）──────────────────────────────────────
async function solveCaptchaWithAI(model, apiKey, imageBase64, prompt) {
  const defaultPrompt = prompt || '這是一個驗證碼圖片，請只回答驗證碼中的文字或數字，不要包含任何解釋。';

  // ── Google Gemini ─────────────────────────────────────────────
  if (model.startsWith('gemini')) {
    const modelId = model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{
        parts: [
          { text: defaultPrompt },
          {
            inline_data: {
              mime_type: 'image/png',
              data: imageBase64
            }
          }
        ]
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 64 }
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API 錯誤 ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text.trim();
  }

  // ── OpenAI GPT-4o ────────────────────────────────────────────
  if (model === 'gpt-4o') {
    const url = 'https://api.openai.com/v1/chat/completions';
    const body = {
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: defaultPrompt },
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imageBase64}`, detail: 'low' }
          }
        ]
      }],
      max_tokens: 64,
      temperature: 0
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API 錯誤 ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content || '';
    return text.trim();
  }

  // ── Anthropic Claude ─────────────────────────────────────────
  if (model.startsWith('claude')) {
    const url = 'https://api.anthropic.com/v1/messages';
    const body = {
      model: model,
      max_tokens: 64,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageBase64
            }
          },
          { type: 'text', text: defaultPrompt }
        ]
      }]
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Claude API 錯誤 ${res.status}: ${errText}`);
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text || '';
    return text.trim();
  }

  throw new Error(`不支援的 AI 模型：${model}`);
}
