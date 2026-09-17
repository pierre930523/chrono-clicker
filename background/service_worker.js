/**
 * ChronoClicker - Background Service Worker (Manifest V3)
 * 負責跨域時間同步請求、CDP 原生可信點擊調度、多目標排程、AI 驗證碼解析
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

// 訊息處理中心
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, payload } = request;

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

  // CDP (Chrome DevTools Protocol) 原生可信點擊派發
  if (action === 'DISPATCH_CDP_CLICK') {
    const tabId = sender.tab ? sender.tab.id : payload.tabId;
    const { x, y, repeat = 1, interval = 50 } = payload;

    dispatchCdpClicks(tabId, x, y, repeat, interval)
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // 轉發選取器激活命令到指定分頁
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

  // ─── 功能 A：多目標定時排程 ──────────────────────────────────
  // popup 在計算好 targetEpoch 後，將 targets 清單連同 targetEpoch 傳到
  // content script 執行，background 只負責在正確時間點透過 tabs.sendMessage
  // 觸發 EXECUTE_MULTI_CLICK。
  if (action === 'SCHEDULE_MULTI_CLICK') {
    const { tabId, targets, targetEpoch, offset } = payload;
    const accurateNow = Date.now() + (offset || 0);
    const delayMs = targetEpoch - accurateNow;

    if (delayMs < 0) {
      sendResponse({ success: false, error: '目標時間已過去' });
      return false;
    }

    setTimeout(() => {
      chrome.tabs.sendMessage(tabId, {
        action: 'EXECUTE_MULTI_CLICK',
        payload: { targets }
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn('[ChronoClicker] EXECUTE_MULTI_CLICK dispatch error:', chrome.runtime.lastError.message);
        }
      });
    }, Math.max(0, delayMs));

    sendResponse({ success: true, scheduledIn: delayMs });
    return false;
  }

  // ─── 功能 B：擷取頁面截圖（CAPTCHA 用）───────────────────────
  if (action === 'CAPTURE_CAPTCHA_SCREENSHOT') {
    const tabId = payload.tabId;
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, dataUrl });
      }
    });
    return true; // 非同步回應
  }

  // ─── 功能 B：AI 驗證碼解析代理（繞過 CORS）─────────────────────
  if (action === 'SOLVE_CAPTCHA_AI') {
    const { model, apiKey, imageBase64, prompt } = payload;

    solveCaptchaWithAI(model, apiKey, imageBase64, prompt)
      .then(answer => sendResponse({ success: true, answer }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ─── CDP 滑鼠事件派發 ─────────────────────────────────────────────

/**
 * 透過 chrome.debugger 派發 isTrusted === true 的真實滑鼠事件
 * x, y 必須是視窗內 (viewport) 座標，單位：CSS 像素
 */
async function dispatchCdpClicks(tabId, x, y, repeat, interval) {
  if (!tabId) throw new Error('Invalid tabId');

  const target = { tabId };

  try {
    await chrome.debugger.attach(target, '1.3');

    for (let i = 0; i < repeat; i++) {
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(x),
        y: Math.round(y)
      });
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1
      });
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1
      });

      if (i < repeat - 1 && interval > 0) {
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    }
  } finally {
    try {
      await chrome.debugger.detach(target);
    } catch (e) {
      // 忽略已分離錯誤
    }
  }
}

// ─── AI 驗證碼解析（功能 B）──────────────────────────────────────

/**
 * 呼叫選定的 AI 大模型 API 解析驗證碼圖片
 * @param {string} model  'gemini-2.0-flash' | 'gpt-4o' | 'claude-3-5-sonnet'
 * @param {string} apiKey 使用者設定的 API Key
 * @param {string} imageBase64 base64 圖片字串（不含 data:image/... 前綴）
 * @param {string} prompt 提示詞
 * @returns {Promise<string>} 解碼後的驗證碼答案
 */
async function solveCaptchaWithAI(model, apiKey, imageBase64, prompt) {
  const defaultPrompt = prompt || '這是一個驗證碼圖片，請只回答驗證碼中的文字或數字，不要包含任何解釋。';

  // ── Google Gemini ─────────────────────────────────────────────
  if (model.startsWith('gemini')) {
    const modelId = model; // e.g. 'gemini-2.0-flash'
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
      model: model, // e.g. 'claude-3-5-sonnet-20241022'
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
