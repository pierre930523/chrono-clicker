/**
 * ChronoClicker - Background Service Worker (Manifest V3)
 * 負責跨域時間同步請求、CDP 原生可信點擊調度與多頁面狀態管理
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
    return true; // 非同步回應
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
});

/**
 * 透過 chrome.debugger 派發 isTrusted === true 的真實滑鼠事件
 */
async function dispatchCdpClicks(tabId, x, y, repeat, interval) {
  if (!tabId) throw new Error('Invalid tabId');

  const target = { tabId };

  try {
    // 附加除錯器
    await chrome.debugger.attach(target, '1.3');

    for (let i = 0; i < repeat; i++) {
      // 1. MouseMoved
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(x),
        y: Math.round(y)
      });

      // 2. MousePressed (左鍵)
      await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: Math.round(x),
        y: Math.round(y),
        button: 'left',
        clickCount: 1
      });

      // 3. MouseReleased
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
    // 執行完畢後分離除錯器以隱藏提示橫幅
    try {
      await chrome.debugger.detach(target);
    } catch (e) {
      // 忽略已分離錯誤
    }
  }
}
