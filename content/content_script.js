/**
 * ChronoClicker - Content Script
 * 包含視覺元素選取器、高精準 Web Worker + 自旋鎖排程器、DOM 事件發射器與懸浮倒數 HUD
 */

(() => {
  // 避免重複載入
  if (window.__chronoClickerInitialized) return;
  window.__chronoClickerInitialized = true;

  console.log('[ChronoClicker] Content script initialized.');

  // 當前頁面的排程狀態
  let currentSchedule = null;
  let activeWorker = null;
  let isPicking = false;
  let hudElement = null;
  let pickerElements = null;

  // ----------------------------------------------------
  // 1. 視覺元素選取器 (Element Picker)
  // ----------------------------------------------------

  function initPickerUI() {
    if (pickerElements) return;

    const highlightBox = document.createElement('div');
    highlightBox.id = 'chrono-picker-highlight';

    const badge = document.createElement('div');
    badge.id = 'chrono-picker-badge';
    badge.textContent = '🎯 點擊鎖定目標 (ESC 取消)';
    highlightBox.appendChild(badge);

    document.body.appendChild(highlightBox);
    pickerElements = { highlightBox, badge };
  }

  function startPicker() {
    initPickerUI();
    isPicking = true;
    pickerElements.highlightBox.style.display = 'block';

    document.addEventListener('mousemove', onPickerMouseMove, true);
    document.addEventListener('click', onPickerClick, true);
    document.addEventListener('keydown', onPickerKeyDown, true);
  }

  function stopPicker() {
    isPicking = false;
    if (pickerElements && pickerElements.highlightBox) {
      pickerElements.highlightBox.style.display = 'none';
    }
    document.removeEventListener('mousemove', onPickerMouseMove, true);
    document.removeEventListener('click', onPickerClick, true);
    document.removeEventListener('keydown', onPickerKeyDown, true);
  }

  function onPickerMouseMove(e) {
    if (!isPicking) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target) return;

    // 忽略 ChronoClicker 自己的 UI
    if (target.closest('#chrono-hud-container') || target.closest('#chrono-picker-highlight')) {
      return;
    }

    const rect = target.getBoundingClientRect();
    const hl = pickerElements.highlightBox;
    hl.style.width = `${rect.width}px`;
    hl.style.height = `${rect.height}px`;
    hl.style.top = `${rect.top}px`;
    hl.style.left = `${rect.left}px`;

    const tag = target.tagName.toLowerCase();
    const id = target.id ? `#${target.id}` : '';
    const cls = target.className && typeof target.className === 'string'
      ? '.' + target.className.trim().split(/\s+/).slice(0, 2).join('.')
      : '';
    const textPreview = (target.innerText || target.value || '').trim().slice(0, 15);
    const label = `${tag}${id}${cls}${textPreview ? ` "${textPreview}"` : ''}`;

    pickerElements.badge.textContent = `🎯 ${label} (點擊鎖定, ESC取消)`;
  }

  function onPickerClick(e) {
    if (!isPicking) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);

    if (!target || target.closest('#chrono-hud-container') || target.closest('#chrono-picker-highlight')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const selector = generateOptimalSelector(target);
    const rect = target.getBoundingClientRect();
    // 儲存頁面絕對座標（加上卷軸偏移），觸發時再轉換回視窗座標
    const coords = {
      x: Math.round(rect.left + rect.width / 2 + window.scrollX),
      y: Math.round(rect.top + rect.height / 2 + window.scrollY),
      isPageCoords: true  // 標記為頁面絕對座標
    };
    const summary = {
      tagName: target.tagName.toLowerCase(),
      id: target.id || '',
      text: (target.innerText || target.value || target.getAttribute('aria-label') || '').trim().slice(0, 30),
      selector: selector,
      coords: coords
    };

    stopPicker();

    // 回報給 popup 與儲存
    chrome.runtime.sendMessage({
      action: 'ELEMENT_PICKED',
      payload: summary
    });

    // 視覺反饋
    target.classList.add('chrono-click-flash');
    setTimeout(() => target.classList.remove('chrono-click-flash'), 800);
  }

  function onPickerKeyDown(e) {
    if (e.key === 'Escape' && isPicking) {
      stopPicker();
      chrome.runtime.sendMessage({ action: 'PICKER_CANCELLED' });
    }
  }

  /**
   * 智慧生成最穩固、可重現的 CSS Selector
   */
  function generateOptimalSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

    // 1. 若有唯一且規範的 id
    if (el.id && !/^\d/.test(el.id) && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
      return `#${CSS.escape(el.id)}`;
    }

    // 2. 特殊屬性 (data-action, data-test-id, name 等)
    const testAttrs = ['data-action', 'data-test-id', 'data-testid', 'name', 'aria-label'];
    for (const attr of testAttrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }

    // 3. 類名組合
    if (el.classList && el.classList.length > 0) {
      const validClasses = Array.from(el.classList).filter(c => !c.startsWith('chrono-') && !/^\d/.test(c));
      if (validClasses.length > 0) {
        const sel = `${el.tagName.toLowerCase()}.${validClasses.map(c => CSS.escape(c)).join('.')}`;
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
    }

    // 4. 路徑回溯結構
    const path = [];
    let curr = el;
    while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.body) {
      let sel = curr.tagName.toLowerCase();
      if (curr.id && !/^\d/.test(curr.id)) {
        sel += `#${CSS.escape(curr.id)}`;
        path.unshift(sel);
        break;
      } else {
        let sibling = curr;
        let nth = 1;
        while ((sibling = sibling.previousElementSibling)) {
          if (sibling.tagName.toLowerCase() === curr.tagName.toLowerCase()) nth++;
        }
        sel += `:nth-of-type(${nth})`;
      }
      path.unshift(sel);
      curr = curr.parentElement;
    }

    return path.join(' > ');
  }

  // ----------------------------------------------------
  // 2. 高精準定時排程器 (Worker + Spin-lock Hybrid)
  // ----------------------------------------------------

  /**
   * 建立防止背景標籤頁休眠節流的 Web Worker
   */
  function createTimerWorker() {
    const workerScript = `
      let timerId = null;
      let active = false;

      self.onmessage = function(e) {
        const { action, targetEpoch, offset } = e.data;

        if (action === 'START') {
          active = true;
          function loop() {
            if (!active) return;
            const now = Date.now() + offset;
            const remain = targetEpoch - now;

            if (remain <= 50) {
              // 剩餘 50ms 內，交由主執行緒自旋鎖微秒鎖定
              self.postMessage({ type: 'IMMINENT', remain });
              active = false;
            } else {
              self.postMessage({ type: 'TICK', remain });
              const nextInterval = remain > 1000 ? 100 : (remain > 200 ? 20 : 5);
              timerId = setTimeout(loop, nextInterval);
            }
          }
          loop();
        } else if (action === 'STOP') {
          active = false;
          if (timerId) clearTimeout(timerId);
        }
      };
    `;

    const blob = new Blob([workerScript], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }

  function startSchedule(config) {
    stopSchedule();

    currentSchedule = config;
    createOrUpdateHUD(config);

    activeWorker = createTimerWorker();
    activeWorker.onmessage = (e) => {
      const { type, remain } = e.data;

      if (type === 'TICK') {
        updateHUDCountdown(remain);
      } else if (type === 'IMMINENT') {
        // 進入極限自旋微秒鎖 (Sub-millisecond spin loop)
        const targetEpoch = config.targetEpoch;
        const offset = config.offset || 0;
        const nowEpoch = Date.now() + offset;
        const remainingMs = targetEpoch - nowEpoch;

        // 目標的 performance.now 錨點
        const targetPerf = performance.now() + remainingMs;

        // 高速自旋等待
        while (performance.now() < targetPerf) {
          // Microsecond spin-lock
        }

        // 觸發點擊！
        executeScheduledClick(config);
      }
    };

    activeWorker.postMessage({
      action: 'START',
      targetEpoch: config.targetEpoch,
      offset: config.offset || 0
    });
  }

  function stopSchedule() {
    if (activeWorker) {
      activeWorker.postMessage({ action: 'STOP' });
      activeWorker.terminate();
      activeWorker = null;
    }
    currentSchedule = null;
    if (hudElement) {
      updateHUDStatus('⏹ 已停止', '#94a3b8');
    }
  }

  // ----------------------------------------------------
  // 3. 多層備案元素解析引擎 (Multi-Fallback Element Resolver)
  // ----------------------------------------------------

  /**
   * 備案 A: XPath 選取器查詢
   */
  function queryByXPath(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue || null;
    } catch (e) {
      console.warn('[ChronoClicker] XPath query failed:', e);
      return null;
    }
  }

  /**
   * 備案 B: 文字內容模糊搜尋（搜尋可見文字含目標字串的可互動元素）
   */
  function queryByTextContent(text) {
    if (!text) return null;
    const lower = text.trim().toLowerCase();
    const candidates = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], [onclick]');
    for (const el of candidates) {
      const elText = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase();
      if (elText.includes(lower)) return el;
    }
    return null;
  }

  /**
   * 備案 C: Shadow DOM 穿透遞迴查詢
   * 遞迴進入所有 ShadowRoot，找出匹配 CSS Selector 的元素
   */
  function queryInShadowDom(root, selector) {
    try {
      const found = root.querySelector(selector);
      if (found) return found;
    } catch (e) {}

    const allEls = root.querySelectorAll('*');
    for (const el of allEls) {
      if (el.shadowRoot) {
        const shadowResult = queryInShadowDom(el.shadowRoot, selector);
        if (shadowResult) return shadowResult;
      }
    }
    return null;
  }

  /**
   * 備案 D: iframe 內部查詢（同源 iframe）
   */
  function queryInIframes(selector) {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) continue;
        const el = iframeDoc.querySelector(selector);
        if (el) return el;
      } catch (e) {
        // 跨域 iframe 無法存取，忽略
      }
    }
    return null;
  }

  /**
   * 主要元素解析流程：依序嘗試所有備案
   * 回傳 { el, method, isCoordOnly } — isCoordOnly=true 代表無元素，需用螢幕座標直接點擊
   */
  function resolveTarget(config) {
    const {
      selector, xpath, searchText, coords,
      useShadowDom = false, useIframeSearch = false, useCoordFallback = false
    } = config;

    // 1️⃣ 標準 CSS Selector
    if (selector) {
      try {
        const el = document.querySelector(selector);
        if (el) return { el, method: 'CSS Selector' };
      } catch (e) {
        console.warn('[ChronoClicker] CSS selector failed:', e.message);
      }
    }

    // 2️⃣ XPath 備案
    if (xpath) {
      const el = queryByXPath(xpath);
      if (el) return { el, method: 'XPath' };
    }

    // 3️⃣ 文字內容搜尋備案
    if (searchText) {
      const el = queryByTextContent(searchText);
      if (el) return { el, method: '文字搜尋' };
    }

    // 4️⃣ Shadow DOM 穿透備案
    if (useShadowDom && selector) {
      const el = queryInShadowDom(document, selector);
      if (el) return { el, method: 'Shadow DOM 穿透' };
    }

    // 5️⃣ iframe 內部搜尋備案
    if (useIframeSearch && selector) {
      const el = queryInIframes(selector);
      if (el) return { el, method: 'iframe 內搜尋' };
    }

    // 6️⃣ 座標 elementFromPoint 備案
    if (coords && coords.x !== undefined && coords.y !== undefined) {
      // 若儲存的是頁面絕對座標，需轉換回視窗座標
      const vx = coords.isPageCoords ? coords.x - window.scrollX : coords.x;
      const vy = coords.isPageCoords ? coords.y - window.scrollY : coords.y;
      const el = document.elementFromPoint(vx, vy);
      if (el && el !== document.body && el !== document.documentElement) {
        return { el, method: '座標拾取 (elementFromPoint)', viewportX: vx, viewportY: vy };
      }
    }

    // 7️⃣ 終極備案：螢幕座標直接點擊（不依賴元素，透過 background 的 CDP 派發）
    if (useCoordFallback && coords && coords.x !== undefined) {
      return { el: null, method: 'CDP 螢幕座標直接點擊', isCoordOnly: true };
    }

    return null;
  }

  // ----------------------------------------------------
  // 點擊觸發引擎
  // ----------------------------------------------------

  function executeScheduledClick(config) {
    const { coords, repeat = 1, interval = 50, useCdp = false } = config;

    const resolved = resolveTarget(config);

    if (!resolved) {
      console.error('[ChronoClicker] ❌ 所有備案均失敗，無法找到目標元素！');
      if (hudElement) updateHUDStatus('❌ 所有備案失敗', '#ef4444');
      return;
    }

    console.log(`[ChronoClicker] ✅ 元素解析成功，方法: ${resolved.method}`);
    if (hudElement) updateHUDStatus(`🎯 觸發中 (${resolved.method})`, '#10b981');

    // 終極備案：純螢幕座標 CDP 點擊（不需 DOM 元素）
    // CDP Input.dispatchMouseEvent 使用視窗座標 (viewport)，
    // 若儲存的是頁面絕對座標，需在此時減去捲軸偏移量轉換為視窗座標。
    if (resolved.isCoordOnly) {
      if (hudElement) updateHUDStatus('🖱️ CDP 座標點擊觸發！', '#f59e0b');
      const vx = coords.isPageCoords ? coords.x - window.scrollX : coords.x;
      const vy = coords.isPageCoords ? coords.y - window.scrollY : coords.y;
      for (let i = 0; i < repeat; i++) {
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'DISPATCH_CDP_CLICK',
            payload: {
              x: vx,
              y: vy,
              repeat: 1,
              interval: 0
            }
          });
        }, i * interval);
      }
      return;
    }

    const targetEl = resolved.el;

    console.log('[ChronoClicker] Triggering clicks on target:', targetEl);
    if (hudElement) updateHUDStatus('🎯 已精準觸發點擊！', '#10b981');

    // 修正：永遠從元素目前的 getBoundingClientRect() 重新計算中心座標，
    // 避免使用拾取當下已過時的 coords.x/y（頁面滾動後座標會錯位）。
    const rect = targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    // 視覺高亮反饋
    targetEl.classList.add('chrono-click-flash');
    setTimeout(() => targetEl.classList.remove('chrono-click-flash'), 1200);

    // 觸發連擊
    let clickCount = 0;
    const performClick = () => {
      // 1. 標準 DOM 完整事件鏈
      const eventOpts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: cx,
        clientY: cy,
        screenX: window.screenX + cx,
        screenY: window.screenY + cy,
        buttons: 1
      };

      try {
        targetEl.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
        targetEl.dispatchEvent(new MouseEvent('mousedown', eventOpts));
        targetEl.dispatchEvent(new PointerEvent('pointerup', eventOpts));
        targetEl.dispatchEvent(new MouseEvent('mouseup', eventOpts));
        targetEl.dispatchEvent(new MouseEvent('click', eventOpts));

        if (typeof targetEl.click === 'function') {
          targetEl.click();
        }
      } catch (err) {
        console.warn('[ChronoClicker] DOM click dispatch error:', err);
      }

      // 2. 若啟用 CDP 原生點擊 (isTrusted === true)
      if (useCdp) {
        chrome.runtime.sendMessage({
          action: 'DISPATCH_CDP_CLICK',
          payload: { x: cx, y: cy, repeat: 1, interval: 0 }
        });
      }

      clickCount++;
      if (clickCount < repeat) {
        setTimeout(performClick, interval);
      }
    };

    performClick();
  }

  // ----------------------------------------------------
  // 4. 懸浮倒數 HUD 介面 (Draggable On-page HUD)
  // ----------------------------------------------------

  function createOrUpdateHUD(config) {
    if (!hudElement) {
      hudElement = document.createElement('div');
      hudElement.id = 'chrono-hud-container';
      hudElement.innerHTML = `
        <div id="chrono-hud-header">
          <div class="chrono-hud-title">⚡ ChronoClicker 倒數</div>
          <div class="chrono-hud-controls">
            <button class="chrono-hud-btn-icon" id="chrono-hud-min-btn" title="最小化">－</button>
            <button class="chrono-hud-btn-icon" id="chrono-hud-close-btn" title="關閉">✕</button>
          </div>
        </div>
        <div id="chrono-hud-body">
          <div class="chrono-hud-target-time">
            <span id="chrono-hud-target-text">--</span>
            <span class="chrono-hud-badge-tz" id="chrono-hud-tz-badge">UTC</span>
          </div>
          <div class="chrono-hud-countdown-box">
            <div class="chrono-hud-countdown-label">距離點擊剩餘</div>
            <div class="chrono-hud-countdown-number" id="chrono-hud-countdown">00:00:00.000</div>
          </div>
          <div class="chrono-hud-target-info">
            <div class="chrono-hud-target-row">
              <span class="chrono-hud-label">目標標籤:</span>
              <span class="chrono-hud-val" id="chrono-hud-target-tag">None</span>
            </div>
            <div class="chrono-hud-target-row">
              <span class="chrono-hud-label">選取器/座標:</span>
              <span class="chrono-hud-val" id="chrono-hud-target-sel">None</span>
            </div>
          </div>
          <div class="chrono-hud-actions">
            <button class="chrono-hud-btn chrono-hud-btn-preview" id="chrono-hud-highlight-btn">👁️ 標記目標</button>
            <button class="chrono-hud-btn chrono-hud-btn-cancel" id="chrono-hud-cancel-btn">⏹ 終止</button>
          </div>
        </div>
      `;
      document.body.appendChild(hudElement);

      // 綁定拖曳功能
      makeDraggable(hudElement, hudElement.querySelector('#chrono-hud-header'));

      // 綁定控制按鈕
      hudElement.querySelector('#chrono-hud-min-btn').addEventListener('click', () => {
        hudElement.classList.toggle('minimized');
      });
      hudElement.querySelector('#chrono-hud-close-btn').addEventListener('click', () => {
        stopSchedule();
        hudElement.style.display = 'none';
      });
      hudElement.querySelector('#chrono-hud-cancel-btn').addEventListener('click', () => {
        stopSchedule();
      });
      hudElement.querySelector('#chrono-hud-highlight-btn').addEventListener('click', () => {
        highlightCurrentTarget();
      });
    }

    hudElement.style.display = 'block';

    // 更新資訊
    const targetDateText = config.formattedTarget || new Date(config.targetEpoch).toLocaleString();
    hudElement.querySelector('#chrono-hud-target-text').textContent = targetDateText;
    hudElement.querySelector('#chrono-hud-tz-badge').textContent = config.timezoneLabel || 'Selected TZ';
    hudElement.querySelector('#chrono-hud-target-tag').textContent = config.tagName || 'Button';
    hudElement.querySelector('#chrono-hud-target-sel').textContent = config.selector || `(${config.coords?.x}, ${config.coords?.y})`;
  }

  function updateHUDCountdown(remainMs) {
    if (!hudElement) return;
    const cdEl = hudElement.querySelector('#chrono-hud-countdown');
    if (!cdEl) return;

    if (remainMs <= 0) {
      cdEl.textContent = '00:00:00.000';
      cdEl.classList.remove('urgent');
      return;
    }

    const totalSec = Math.floor(remainMs / 1000);
    const ms = Math.floor(remainMs % 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n, len = 2) => String(n).padStart(len, '0');
    cdEl.textContent = `${pad(hours)}:${pad(mins)}:${pad(secs)}.${pad(ms, 3)}`;

    if (remainMs < 5000) {
      cdEl.classList.add('urgent');
    } else {
      cdEl.classList.remove('urgent');
    }
  }

  function updateHUDStatus(text, color) {
    if (!hudElement) return;
    const cdEl = hudElement.querySelector('#chrono-hud-countdown');
    if (cdEl) {
      cdEl.textContent = text;
      if (color) cdEl.style.color = color;
    }
  }

  function highlightCurrentTarget() {
    if (!currentSchedule) return;
    let target = null;
    if (currentSchedule.selector) {
      target = document.querySelector(currentSchedule.selector);
    }
    if (!target && currentSchedule.coords) {
      const c = currentSchedule.coords;
      const vx = c.isPageCoords ? c.x - window.scrollX : c.x;
      const vy = c.isPageCoords ? c.y - window.scrollY : c.y;
      target = document.elementFromPoint(vx, vy);
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('chrono-click-flash');
      setTimeout(() => target.classList.remove('chrono-click-flash'), 1000);
    }
  }

  function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      if (e.target.closest('.chrono-hud-btn-icon')) return;
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = `${element.offsetTop - pos2}px`;
      element.style.left = `${element.offsetLeft - pos1}px`;
      element.style.right = 'auto';
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // ----------------------------------------------------
  // 5. 監聽擴充功能命令 (Runtime Messaging)
  // ----------------------------------------------------

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const { action, payload } = request;

    if (action === 'ACTIVATE_PICKER') {
      startPicker();
      sendResponse({ success: true, status: 'picker_active' });
      return false;
    }

    if (action === 'CANCEL_PICKER') {
      stopPicker();
      sendResponse({ success: true });
      return false;
    }

    if (action === 'START_COUNTDOWN') {
      startSchedule(payload);
      sendResponse({ success: true });
      return false;
    }

    if (action === 'STOP_COUNTDOWN') {
      stopSchedule();
      sendResponse({ success: true });
      return false;
    }

    if (action === 'TEST_CLICK') {
      executeScheduledClick(payload);
      sendResponse({ success: true });
      return false;
    }

    if (action === 'GET_CONTENT_STATUS') {
      sendResponse({
        isScheduled: !!currentSchedule,
        schedule: currentSchedule
      });
      return false;
    }

    // 座標擷取模式：點擊一次頁面任意位置，回傳精確座標並顯示 HUD 提示
    if (action === 'ACTIVATE_COORD_CAPTURE') {
      activateCoordCapture();
      sendResponse({ success: true });
      return false;
    }

    // 多目標依序點擊（功能 A）
    if (action === 'EXECUTE_MULTI_CLICK') {
      const { targets } = payload;
      if (!Array.isArray(targets) || targets.length === 0) {
        sendResponse({ success: false, error: '無點擊目標' });
        return false;
      }
      targets.forEach((t) => {
        setTimeout(() => {
          executeScheduledClick({
            ...t,
            repeat: t.repeat || 1,
            interval: t.interval || 50,
            useCdp: t.useCdp || false
          });
        }, t.delayMs || 0);
      });
      sendResponse({ success: true });
      return false;
    }

    // 驗證碼填入（功能 B）
    if (action === 'CAPTCHA_FILL_ANSWER') {
      const { answer } = payload;
      const filled = tryCaptchaFill(answer);
      sendResponse({ success: filled });
      return false;
    }

    // 偵測頁面驗證碼存在（功能 B）
    if (action === 'DETECT_CAPTCHA') {
      const detected = detectCaptchaPresence();
      sendResponse({ detected: !!detected, type: detected ? detected.type : null });
      return false;
    }
  });

  // ----------------------------------------------------
  // 座標擷取模式 (Coordinate Capture Mode)
  // ----------------------------------------------------
  let coordCaptureActive = false;

  function activateCoordCapture() {
    if (coordCaptureActive) return;
    coordCaptureActive = true;

    // 顯示覆蓋提示層
    const overlay = document.createElement('div');
    overlay.id = 'chrono-coord-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      cursor: 'crosshair',
      background: 'rgba(0, 242, 254, 0.07)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: '20px',
      fontFamily: 'monospace',
      pointerEvents: 'all'
    });

    const banner = document.createElement('div');
    Object.assign(banner.style, {
      background: 'rgba(15,23,42,0.9)',
      border: '1px solid #00f2fe',
      borderRadius: '8px',
      padding: '10px 20px',
      color: '#00f2fe',
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '0 0 20px rgba(0,242,254,0.4)',
      pointerEvents: 'none'
    });
    banner.textContent = '📍 點擊目標位置以擷取座標 (ESC 取消)';
    overlay.appendChild(banner);

    const coordDisplay = document.createElement('div');
    Object.assign(coordDisplay.style, {
      marginTop: '8px',
      background: 'rgba(0,0,0,0.7)',
      color: '#7dd3fc',
      padding: '4px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      pointerEvents: 'none'
    });
    coordDisplay.textContent = 'X: - , Y: -';
    overlay.appendChild(coordDisplay);

    document.body.appendChild(overlay);

    const onMouseMove = (e) => {
      coordDisplay.textContent = `X: ${e.clientX} , Y: ${e.clientY}`;
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        chrome.runtime.sendMessage({ action: 'COORD_CAPTURE_CANCELLED' });
      }
    };

    const onClick = (e) =\u003e {
      e.preventDefault();
      e.stopPropagation();
      // 儲存頁面絕對座標（clientX + scrollX），不因卷軸變化而失效
      const x = e.clientX + window.scrollX;
      const y = e.clientY + window.scrollY;
      cleanup();

      // 回報座標給 popup
      chrome.runtime.sendMessage({
        action: 'COORD_CAPTURED',
        payload: { x, y, isPageCoords: true }
      });

      // 視覺確認閃光
      const flash = document.createElement('div');
      Object.assign(flash.style, {
        position: 'fixed',
        left: `${x - 12}px`,
        top: `${y - 12}px`,
        width: '24px',
        height: '24px',
        borderRadius: '50%',
        background: 'rgba(0,242,254,0.6)',
        boxShadow: '0 0 20px #00f2fe',
        zIndex: '2147483646',
        pointerEvents: 'none',
        transition: 'all 0.6s ease-out'
      });
      document.body.appendChild(flash);
      setTimeout(() => {
        flash.style.transform = 'scale(4)';
        flash.style.opacity = '0';
      }, 50);
      setTimeout(() => flash.remove(), 700);
    };

    function cleanup() {
      coordCaptureActive = false;
      overlay.remove();
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    }

    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);
  }

  // ----------------------------------------------------
  // 驗證碼偵測與填入輔助函式（功能 B）
  // ----------------------------------------------------

  /**
   * 偵測頁面上是否存在常見驗證碼元素。
   * 回傳 { type, element } 或 null。
   */
  function detectCaptchaPresence() {
    // reCAPTCHA v2
    const recaptchaFrame = document.querySelector('iframe[src*="recaptcha"]');
    if (recaptchaFrame) return { type: 'reCAPTCHA', element: recaptchaFrame };

    // hCaptcha
    const hcaptchaFrame = document.querySelector('iframe[src*="hcaptcha"]');
    if (hcaptchaFrame) return { type: 'hCaptcha', element: hcaptchaFrame };

    // Cloudflare Turnstile
    const turnstile = document.querySelector('iframe[src*="challenges.cloudflare"]');
    if (turnstile) return { type: 'Turnstile', element: turnstile };

    // 圖片驗證碼輸入框（常見屬性名）
    const imgCaptchaInput = document.querySelector(
      'input[name*="captcha" i], input[id*="captcha" i], input[placeholder*="驗證碼" i], input[placeholder*="captcha" i]'
    );
    if (imgCaptchaInput) return { type: 'TextCaptcha', element: imgCaptchaInput };

    return null;
  }

  /**
   * 嘗試將 AI 解碼後的驗證碼答案填入對應的輸入框。
   * 回傳 true 表示成功找到並填入。
   */
  function tryCaptchaFill(answer) {
    if (!answer) return false;
    const input = document.querySelector(
      'input[name*="captcha" i], input[id*="captcha" i], input[placeholder*="驗證碼" i], input[placeholder*="captcha" i], input[autocomplete="off"][type="text"]'
    );
    if (input) {
      // 觸發 React/Vue 兼容的 input 事件
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, answer);
      } else {
        input.value = answer;
      }
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.classList.add('chrono-click-flash');
      setTimeout(() => input.classList.remove('chrono-click-flash'), 800);
      return true;
    }
    return false;
  }

})();

