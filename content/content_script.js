/**
 * ChronoClicker - Content Script v1.2 (Ticket Plus 深度適配與全能實體滑鼠強化版)
 * 包含：
 *   1. 智慧互動元素解析器（精準鎖定按鈕本體，穿透 Vue/Nuxt 內層 span/ripple）
 *   2. 穩定 CSS Selector / XPath / 內容文字三合一智慧生成器（自動濾除暫態 class）
 *   3. 遠大售票 (ticketplus.com.tw) 專屬適配引擎（自動解鎖 pointer-events、極速 10ms 輪詢）
 *   4. 三重擊發架構：OS 系統級實體滑鼠 + CDP 原生 isTrusted 驅動 + 穿透型 DOM/Vue 事件
 *   5. 高精準 Web Worker + 自旋鎖排程器與可拖曳倒數 HUD
 */

(() => {
  // 避免重複載入
  if (window.__chronoClickerInitialized) return;
  window.__chronoClickerInitialized = true;

  console.log('[ChronoClicker] Content script v1.2 initialized.');

  const isTicketPlus = window.location.hostname.includes('ticketplus.com.tw');
  if (isTicketPlus) {
    console.log('[ChronoClicker] 🎫 遠大售票系統 (Ticket Plus) 專屬強化模組已就緒');
  }

  // 當前頁面的排程狀態
  let currentSchedule = null;
  let activeWorker = null;
  let isPicking = false;
  let hudElement = null;
  let pickerElements = null;

  // 螢幕座標動態校準：初始預設值納入視窗螢幕座標 (screenLeft, screenTop) 與邊框/工具列高度
  function getScreenOffset() {
    const winX = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
    const winY = window.screenTop !== undefined ? window.screenTop : window.screenY;
    const borderX = Math.max(0, (window.outerWidth - window.innerWidth) / 2);
    const titleBarY = Math.max(0, window.outerHeight - window.innerHeight - borderX);
    return {
      dx: (winX || 0) + borderX,
      dy: (winY || 0) + (titleBarY || 70)
    };
  }

  let calibratedScreenOffset = getScreenOffset();

  window.addEventListener('mousemove', (e) => {
    if (e.screenX !== undefined && e.clientX !== undefined) {
      calibratedScreenOffset = {
        dx: e.screenX - e.clientX,
        dy: e.screenY - e.clientY
      };
    }
  }, { passive: true });

  // 畫面動態 Toast 提示訊息
  function showToast(msg) {
    const existing = document.getElementById('chrono-page-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'chrono-page-toast';
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2147483647',
      background: 'rgba(15, 23, 42, 0.95)',
      color: '#38bdf8',
      border: '1px solid #38bdf8',
      borderRadius: '8px',
      padding: '12px 24px',
      fontSize: '14px',
      fontWeight: '600',
      boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
      textAlign: 'center',
      whiteSpace: 'pre-line',
      pointerEvents: 'none',
      transition: 'opacity 0.4s ease'
    });
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

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

  /**
   * 智慧尋找可互動的按鈕本體（避免選中 Vue/Nuxt 內層 span 或 ripple 背景）
   */
  function findInteractiveTarget(el) {
    if (!el || el === document.body || el === document.documentElement) return el;
    const interactive = el.closest(
      'button, a, [role="button"], input[type="submit"], input[type="button"], select, .v-btn, .q-btn'
    );
    return interactive || el;
  }

  function onPickerMouseMove(e) {
    if (!isPicking) return;
    const rawTarget = document.elementFromPoint(e.clientX, e.clientY);
    if (!rawTarget) return;

    // 忽略 ChronoClicker 自己的 UI
    if (rawTarget.closest('#chrono-hud-container') || rawTarget.closest('#chrono-picker-highlight')) {
      return;
    }

    const target = findInteractiveTarget(rawTarget);
    const rect = target.getBoundingClientRect();
    const hl = pickerElements.highlightBox;
    hl.style.width = `${rect.width}px`;
    hl.style.height = `${rect.height}px`;
    hl.style.top = `${rect.top}px`;
    hl.style.left = `${rect.left}px`;

    const tag = target.tagName.toLowerCase();
    const id = target.id ? `#${target.id}` : '';
    const textPreview = extractButtonText(target).slice(0, 18);
    const label = `${tag}${id}${textPreview ? ` "${textPreview}"` : ''}`;

    pickerElements.badge.textContent = `🎯 ${label} (點擊鎖定, ESC取消)`;
  }

  function onPickerClick(e) {
    if (!isPicking) return;
    const rawTarget = document.elementFromPoint(e.clientX, e.clientY);

    if (!rawTarget || rawTarget.closest('#chrono-hud-container') || rawTarget.closest('#chrono-picker-highlight')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // 鎖定互動父級（如 button 而非內層 span）
    const target = findInteractiveTarget(rawTarget);
    const selector = generateOptimalSelector(target);
    const text = extractButtonText(target);
    const xpath = generateOptimalXPath(target, text);
    const coords = getElementCoordinates(target);

    const summary = {
      tagName: target.tagName.toLowerCase(),
      id: target.id || '',
      text: text,
      selector: selector,
      xpath: xpath,
      searchText: text,
      coords: coords,
      isTicketPlus: isTicketPlus
    };

    stopPicker();

    // 1. 直接持久化至 chrome.storage.local，徹底杜絕因 popup 關閉而遺失選取資料
    const domain = window.location.hostname || 'global';
    chrome.storage.local.get([`site_${domain}`], (res) => {
      const current = res[`site_${domain}`] || {};
      const updated = {
        ...current,
        selector: selector,
        xpath: xpath,
        searchText: text,
        coords: coords,
        targetPreview: `${target.tagName.toUpperCase()}${target.id ? '#' + target.id : ''} "${text || ''}"`,
        isTicketPlus: isTicketPlus
      };
      chrome.storage.local.set({ [`site_${domain}`]: updated });
    });

    // 2. 回報給 popup 與 background
    chrome.runtime.sendMessage({
      action: 'ELEMENT_PICKED',
      payload: summary
    });

    // 3. 頁面 Toast 即時回饋
    showToast(`🎯 已鎖定目標元素：${summary.tagName.toUpperCase()}${summary.id ? '#' + summary.id : ''} "${text.slice(0, 15)}"\n✅ 設定已自動保存！`);

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
   * 提煉元素乾淨的按鈕文字（過濾空白與換行）
   */
  function extractButtonText(el) {
    if (!el) return '';
    const text = el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  /**
   * 智慧生成最穩固、抗 Vue/Nuxt 動態變更的 CSS Selector
   * 自動過濾 disabled、loading、active 等狀態類名
   */
  function generateOptimalSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';

    // 1. 若有唯一且非動態產生的 id
    if (el.id && !/^\d/.test(el.id) && !/(?:input-\d+|uuid-|v-)/i.test(el.id)) {
      try {
        if (document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
          return `#${CSS.escape(el.id)}`;
        }
      } catch (e) {}
    }

    // 2. 業務語意屬性 (data-action, data-test-id, name 等)
    const testAttrs = ['data-action', 'data-test-id', 'data-testid', 'name', 'aria-label'];
    for (const attr of testAttrs) {
      const val = el.getAttribute(attr);
      if (val) {
        const sel = `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
        try {
          if (document.querySelectorAll(sel).length === 1) return sel;
        } catch (e) {}
      }
    }

    // 3. 穩定類名（嚴格排除 Vue/Nuxt 暫態類別如 disabled, loading, active）
    const TRANSIENT_CLASSES = /(?:disabled|active|hover|focus|loading|selected|open|show|hide|v-ripple|data-v-|_nuxt|nuxt|v-btn--(?:disabled|active|loading)|q-btn--(?:rectangle|standard))/i;

    if (el.classList && el.classList.length > 0) {
      const stableClasses = Array.from(el.classList).filter(c => {
        return !c.startsWith('chrono-') && !/^\d/.test(c) && !TRANSIENT_CLASSES.test(c);
      });

      if (stableClasses.length > 0) {
        const sel = `${el.tagName.toLowerCase()}.${stableClasses.map(c => CSS.escape(c)).join('.')}`;
        try {
          if (document.querySelectorAll(sel).length === 1) return sel;
        } catch (e) {}
      }
    }

    // 4. 作用域卡片/清單容器定位（Ticket Plus 與 Vuetify 常見之場次卡片、票價區，避免誤選首個按鈕）
    const container = el.closest('.session-item, .v-card, .v-expansion-panel, .ticket-row, tr, [data-session-id], [data-id]');
    if (container && container.parentElement) {
      const siblings = Array.from(container.parentElement.children).filter(ch => ch.tagName === container.tagName);
      const containerIdx = siblings.indexOf(container) + 1;
      const containerTag = container.tagName.toLowerCase();
      const containerClasses = Array.from(container.classList).filter(c => !TRANSIENT_CLASSES.test(c) && !c.startsWith('chrono-')).slice(0, 2);
      const classStr = containerClasses.length > 0 ? '.' + containerClasses.map(c => CSS.escape(c)).join('.') : '';
      const targetTag = el.tagName.toLowerCase();
      const targetClasses = Array.from(el.classList).filter(c => !TRANSIENT_CLASSES.test(c) && !c.startsWith('chrono-')).slice(0, 2);
      const targetClassStr = targetClasses.length > 0 ? '.' + targetClasses.map(c => CSS.escape(c)).join('.') : '';

      const scopedSel = `${containerTag}${classStr}:nth-of-type(${containerIdx}) ${targetTag}${targetClassStr}`;
      try {
        if (document.querySelector(scopedSel) === el) return scopedSel;
      } catch (e) {}
    }

    // 5. 路徑回溯結構
    const path = [];
    let curr = el;
    while (curr && curr.nodeType === Node.ELEMENT_NODE && curr !== document.body) {
      let sel = curr.tagName.toLowerCase();
      if (curr.id && !/^\d/.test(curr.id) && !/(?:input-\d+|uuid-|v-)/i.test(curr.id)) {
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

  /**
   * 智慧生成強健的 XPath 備案
   */
  function generateOptimalXPath(el, text) {
    const tag = el.tagName.toLowerCase();
    if (text && text.length <= 20) {
      return `//${tag}[contains(., '${text}') or contains(text(), '${text}')]`;
    }
    if (el.id) {
      return `//${tag}[@id='${el.id}']`;
    }
    return `//${tag}`;
  }

  /**
   * 計算元素在 視窗 (Viewport)、頁面 (Page) 與 螢幕物理像素 (Screen) 的絕對精確座標
   */
  function getElementCoordinates(el) {
    if (!el) return { x: 0, y: 0, viewportX: 0, viewportY: 0, screenX: 0, screenY: 0, physicalX: 0, physicalY: 0 };

    // 確保元素進入可視範圍
    const initialRect = el.getBoundingClientRect();
    const isOffscreen = initialRect.top < 0 || initialRect.bottom > window.innerHeight || initialRect.left < 0 || initialRect.right > window.innerWidth;
    if (isOffscreen) {
      const origBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      try {
        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
      } catch (e) {
        el.scrollIntoView(true);
      }
      document.documentElement.style.scrollBehavior = origBehavior;
    }

    const rect = el.getBoundingClientRect();
    const vx = Math.round(rect.left + rect.width / 2);
    const vy = Math.round(rect.top + rect.height / 2);
    const pageX = Math.round(vx + window.scrollX);
    const pageY = Math.round(vy + window.scrollY);

    // 螢幕 CSS 座標
    const screenX = Math.round(vx + calibratedScreenOffset.dx);
    const screenY = Math.round(vy + calibratedScreenOffset.dy);

    // 螢幕物理像素座標 (整合 Windows 顯示縮放比例 DPI)
    const dpr = window.devicePixelRatio || 1;
    const physicalX = Math.round(screenX * dpr);
    const physicalY = Math.round(screenY * dpr);

    return {
      x: pageX,
      y: pageY,
      viewportX: vx,
      viewportY: vy,
      screenX: screenX,
      screenY: screenY,
      physicalX: physicalX,
      physicalY: physicalY,
      dpr: dpr,
      isPageCoords: true
    };
  }

  // ----------------------------------------------------
  // 2. 高精準定時排程器 (Worker + Spin-lock Hybrid)
  // ----------------------------------------------------

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

    // 若啟用 CDP 或在 Ticket Plus 網站，預先掛載除錯器 (消除零秒延遲)
    if (config.useCdp || isTicketPlus) {
      chrome.runtime.sendMessage({ action: 'PRE_ATTACH_CDP' });
    }

    activeWorker = createTimerWorker();
    activeWorker.onmessage = (e) => {
      const { type, remain } = e.data;

      if (type === 'TICK') {
        updateHUDCountdown(remain);
      } else if (type === 'IMMINENT') {
        // 進入微秒自旋鎖定
        const targetEpoch = config.targetEpoch;
        const offset = config.offset || 0;
        const nowEpoch = Date.now() + offset;
        const remainingMs = targetEpoch - nowEpoch;

        const targetPerf = performance.now() + remainingMs;
        while (performance.now() < targetPerf) {
          // Sub-millisecond spin-lock
        }

        executeScheduledClickWithPolling(config);
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
    chrome.runtime.sendMessage({ action: 'DETACH_CDP' });
  }

  // ----------------------------------------------------
  // 3. 多層備案元素解析引擎與 Ticket Plus 專用解鎖器
  // ----------------------------------------------------

  function queryByXPath(xpath) {
    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return result.singleNodeValue || null;
    } catch (e) {
      return null;
    }
  }

  function queryByTextContent(text) {
    if (!text) return null;
    const lower = text.trim().toLowerCase();
    const candidates = document.querySelectorAll('button, a, input[type="submit"], input[type="button"], [role="button"], .v-btn, [onclick]');
    for (const el of candidates) {
      const elText = extractButtonText(el).toLowerCase();
      if (elText.includes(lower)) return el;
    }
    return null;
  }

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

  function queryInIframes(selector) {
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) continue;
        const el = iframeDoc.querySelector(selector);
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  /**
   * 專門解除按鈕禁用屬性與 pointer-events 樣式（破解售票倒數未開賣狀態）
   */
  function forceUnlockElement(el) {
    if (!el) return;
    try {
      const targets = [el];
      const parentBtn = el.closest('button, [role="button"], a, input');
      if (parentBtn && parentBtn !== el) targets.push(parentBtn);

      const parentFieldset = el.closest('fieldset');
      if (parentFieldset) {
        parentFieldset.removeAttribute('disabled');
      }

      for (const target of targets) {
        if (target.disabled) target.disabled = false;
        target.removeAttribute('disabled');
        target.removeAttribute('aria-disabled');
        if (target.classList) {
          target.classList.remove('v-btn--disabled', 'disabled', 'is-disabled', 'btn-disabled');
        }
        target.style.setProperty('pointer-events', 'auto', 'important');
        target.style.setProperty('cursor', 'pointer', 'important');

        const allDescendants = target.querySelectorAll('*');
        allDescendants.forEach(child => {
          child.style.setProperty('pointer-events', 'auto', 'important');
          if (child.disabled) child.disabled = false;
          child.removeAttribute('disabled');
        });
      }
    } catch (e) {}
  }

  /**
   * 綜合解析流程：依序嘗試 Selector -> 文字搜尋 -> XPath -> Shadow DOM -> iframe -> 座標
   */
  function resolveTarget(config) {
    const {
      selector, xpath, searchText, coords,
      useShadowDom = false, useIframeSearch = false, useCoordFallback = true
    } = config;

    // 1️⃣ 標準 CSS Selector
    if (selector) {
      try {
        const el = document.querySelector(selector);
        if (el) return { el, method: 'CSS Selector' };
      } catch (e) {}
    }

    // 2️⃣ 使用者指定按鈕文字搜尋（精準依使用者輸入的文字尋找按鈕）
    if (searchText) {
      const el = queryByTextContent(searchText);
      if (el) return { el, method: `按鈕文字搜尋 [${searchText}]` };
    }

    // 3️⃣ XPath 備案
    if (xpath) {
      const el = queryByXPath(xpath);
      if (el) return { el, method: 'XPath' };
    }

    // 4️⃣ Ticket Plus 專屬智慧探索（僅在使用者未指定或未匹配成功時作為備案）
    if (isTicketPlus && !searchText) {
      const tpKeywords = ['立即購票', '選擇場次', '立即訂購', '確定', '確認張數', '下一步', '前往結帳'];
      for (const kw of tpKeywords) {
        const el = queryByTextContent(kw);
        if (el) return { el, method: `Ticket Plus 關鍵字 [${kw}]` };
      }
      // 搜尋任何非 disabled 的主要按鈕
      const anyActiveBtn = document.querySelector('button.v-btn:not(.v-btn--disabled), button[type="button"]:not([disabled])');
      if (anyActiveBtn) return { el: anyActiveBtn, method: 'Ticket Plus 活躍按鈕' };
    }

    // 5️⃣ Shadow DOM
    if (useShadowDom && selector) {
      const el = queryInShadowDom(document, selector);
      if (el) return { el, method: 'Shadow DOM 穿透' };
    }

    // 6️⃣ iframe 搜尋
    if (useIframeSearch && selector) {
      const el = queryInIframes(selector);
      if (el) return { el, method: 'iframe 內搜尋' };
    }

    // 7️⃣ 座標 elementFromPoint 備案
    if (coords && coords.x !== undefined && coords.y !== undefined) {
      if (coords.isPageCoords) {
        const currentVy = coords.y - window.scrollY;
        const currentVx = coords.x - window.scrollX;
        if (currentVy < 0 || currentVy > window.innerHeight || currentVx < 0 || currentVx > window.innerWidth) {
          window.scrollTo({
            left: Math.max(0, coords.x - window.innerWidth / 2),
            top: Math.max(0, coords.y - window.innerHeight / 2),
            behavior: 'instant'
          });
        }
      }
      const vx = coords.isPageCoords ? coords.x - window.scrollX : coords.x;
      const vy = coords.isPageCoords ? coords.y - window.scrollY : coords.y;
      const el = document.elementFromPoint(vx, vy);
      if (el && el !== document.body && el !== document.documentElement) {
        return { el, method: '座標拾取 (elementFromPoint)', viewportX: vx, viewportY: vy };
      }
    }

    // 8️⃣ 終極備案：座標直接點擊 (不需 DOM 元素)
    if (useCoordFallback && coords && (coords.x !== undefined || coords.viewportX !== undefined)) {
      return { el: null, method: '原生座標直接點擊', isCoordOnly: true };
    }

    return null;
  }

  // ----------------------------------------------------
  // 4. 極速輪詢與點擊觸發引擎
  // ----------------------------------------------------

  /**
   * 零秒開賣極速輪詢機制：針對 Ticket Plus 全面監測未開賣文字與 disabled 狀態，
   * 每次輪詢動態重新解析 DOM，緊扣 Vue 替換按鈕節點瞬間以 10ms 頻率擊發！
   */
  function executeScheduledClickWithPolling(config) {
    const pollMaxDuration = config.pollDuration || (isTicketPlus ? 3000 : 800);
    const startTime = performance.now();

    function tryTrigger() {
      // 每次輪詢皆重新解析 DOM，解決開賣瞬間 Vue 以全新 DOM 節點置換按鈕的空擊問題
      const resolved = resolveTarget(config);

      // 若找到元素且有元素本體
      if (resolved && resolved.el) {
        const el = resolved.el;
        const text = extractButtonText(el);
        const isPreSaleText = /(?:尚未開[賣售]|即將開[賣售]|敬請期待|未開[賣售]|開賣倒數|暫停販售)/i.test(text);
        const isDisabled = el.disabled || el.classList.contains('v-btn--disabled') || el.getAttribute('aria-disabled') === 'true';

        // 若仍處於尚未開售或禁用狀態且尚未逾時，以 10ms 頻率極速輪詢等待 Vue 響應式渲染
        if ((isPreSaleText || isDisabled) && (performance.now() - startTime < pollMaxDuration)) {
          setTimeout(tryTrigger, 10);
          return;
        }

        // 解鎖並擊發！
        forceUnlockElement(el);
        executeScheduledClick(config, resolved);
        return;
      }

      // 若僅能依賴純座標
      if (resolved && resolved.isCoordOnly) {
        executeScheduledClick(config, resolved);
        return;
      }

      // 尚未找到但仍在輪詢期間
      if (performance.now() - startTime < pollMaxDuration) {
        setTimeout(tryTrigger, 10);
      } else {
        console.error('[ChronoClicker] ❌ 輪詢時限已過，所有備案均失敗！');
        if (hudElement) updateHUDStatus('❌ 輪詢逾時未開售', '#ef4444');
      }
    }

    tryTrigger();
  }

  /**
   * 執行擊發點擊 (系統實體滑鼠 + CDP 原生 isTrusted + DOM/Vue 事件鏈)
   */
  function executeScheduledClick(config, resolved) {
    if (!resolved) {
      resolved = resolveTarget(config);
    }

    if (!resolved) {
      console.error('[ChronoClicker] ❌ 無法解析目標點擊元素！');
      if (hudElement) updateHUDStatus('❌ 目標無法定位', '#ef4444');
      return;
    }

    const {
      coords, repeat = 1, interval = 50,
      useCdp = false, useSystemMouse = false
    } = config;

    console.log(`[ChronoClicker] 🎯 元素解析成功，方法: ${resolved.method}`);
    if (hudElement) updateHUDStatus(`🎯 擊發中 (${resolved.method})`, '#10b981');

    // ─── A. 純座標點擊模式 ────────────────────────────
    if (resolved.isCoordOnly) {
      const vx = coords.viewportX !== undefined ? coords.viewportX : (coords.isPageCoords ? coords.x - window.scrollX : coords.x);
      const vy = coords.viewportY !== undefined ? coords.viewportY : (coords.isPageCoords ? coords.y - window.scrollY : coords.y);
      const sx = coords.screenX !== undefined ? coords.screenX : Math.round(vx + calibratedScreenOffset.dx);
      const sy = coords.screenY !== undefined ? coords.screenY : Math.round(vy + calibratedScreenOffset.dy);
      const dpr = window.devicePixelRatio || 1;
      const px = coords.physicalX !== undefined ? coords.physicalX : Math.round(sx * dpr);
      const py = coords.physicalY !== undefined ? coords.physicalY : Math.round(sy * dpr);

      // 1. 若有系統滑鼠伺服器
      if (useSystemMouse) {
        chrome.runtime.sendMessage({
          action: 'DISPATCH_SYSTEM_MOUSE_CLICK',
          payload: { screenX: sx, screenY: sy, physicalX: px, physicalY: py, repeat, interval }
        });
      }

      // 2. 原生 CDP 點擊
      chrome.runtime.sendMessage({
        action: 'DISPATCH_CDP_CLICK',
        payload: { x: vx, y: vy, repeat, interval }
      });
      return;
    }

    // ─── B. 元素實體擊發模式 ──────────────────────────
    const targetEl = resolved.el;
    forceUnlockElement(targetEl);

    // 計算最新座標
    const elementCoords = getElementCoordinates(targetEl);
    const { viewportX, viewportY, screenX, screenY, physicalX, physicalY } = elementCoords;

    // 視覺高亮反饋
    targetEl.classList.add('chrono-click-flash');
    setTimeout(() => targetEl.classList.remove('chrono-click-flash'), 1200);

    // 1. 第一重：系統級本機實體滑鼠硬體點擊 (OS Hardware Mouse Driver)
    if (useSystemMouse) {
      chrome.runtime.sendMessage({
        action: 'DISPATCH_SYSTEM_MOUSE_CLICK',
        payload: {
          screenX: screenX,
          screenY: screenY,
          physicalX: physicalX,
          physicalY: physicalY,
          repeat: repeat,
          interval: interval
        }
      });
    }

    // 2. 第二重：Chrome DevTools Protocol (CDP) 真正原生 isTrusted: true 點擊
    const shouldRunCdp = useCdp || isTicketPlus;
    if (shouldRunCdp) {
      chrome.runtime.sendMessage({
        action: 'DISPATCH_CDP_CLICK',
        payload: {
          x: viewportX,
          y: viewportY,
          repeat: repeat,
          interval: interval
        }
      });
    }

    // 3. 第三重：穿透型 DOM 事件序列
    // 關鍵防禦機制：若已啟用 CDP 或本機實體滑鼠，切勿同步派發 isTrusted === false 的合成事件，
    // 否則 Ticket Plus 反爬蟲偵測會先接收到合成假事件而直接封鎖或判定作弊！
    if (!shouldRunCdp && !useSystemMouse) {
      let clickCount = 0;
      const performDomClick = () => {
        const eventOpts = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: viewportX,
          clientY: viewportY,
          screenX: screenX,
          screenY: screenY,
          buttons: 1,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          pressure: 0.5
        };

        try {
          targetEl.dispatchEvent(new PointerEvent('pointerover', eventOpts));
          targetEl.dispatchEvent(new MouseEvent('mouseover', eventOpts));
          targetEl.dispatchEvent(new PointerEvent('pointerenter', eventOpts));
          targetEl.dispatchEvent(new MouseEvent('mouseenter', eventOpts));

          targetEl.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
          targetEl.dispatchEvent(new MouseEvent('mousedown', eventOpts));

          if (typeof targetEl.focus === 'function') targetEl.focus();

          const releaseOpts = { ...eventOpts, buttons: 0, pressure: 0 };
          targetEl.dispatchEvent(new PointerEvent('pointerup', releaseOpts));
          targetEl.dispatchEvent(new MouseEvent('mouseup', releaseOpts));
          targetEl.dispatchEvent(new MouseEvent('click', releaseOpts));

          if (typeof targetEl.click === 'function') {
            targetEl.click();
          }
        } catch (err) {
          console.warn('[ChronoClicker] DOM click dispatch warning:', err);
        }

        clickCount++;
        if (clickCount < repeat) {
          setTimeout(performDomClick, interval);
        }
      };

      performDomClick();
    } else {
      // 在 CDP/實體滑鼠模式下，僅在 500ms 後作為保險備案（若頁面仍在當前頁且未跳轉）
      setTimeout(() => {
        if (document.body.contains(targetEl)) {
          try { targetEl.click(); } catch (e) {}
        }
      }, 500);
    }
  }

  // ----------------------------------------------------
  // 5. 懸浮倒數 HUD 介面
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
            ${isTicketPlus ? '<div class="chrono-hud-target-row" style="color:#38bdf8;font-weight:600;">🎫 遠大售票極速模式已啟用</div>' : ''}
          </div>
          <div class="chrono-hud-actions">
            <button class="chrono-hud-btn chrono-hud-btn-preview" id="chrono-hud-highlight-btn">👁️ 標記目標</button>
            <button class="chrono-hud-btn chrono-hud-btn-cancel" id="chrono-hud-cancel-btn">⏹ 終止</button>
          </div>
        </div>
      `;
      document.body.appendChild(hudElement);

      makeDraggable(hudElement, hudElement.querySelector('#chrono-hud-header'));

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

    const targetDateText = config.formattedTarget || new Date(config.targetEpoch).toLocaleString();
    hudElement.querySelector('#chrono-hud-target-text').textContent = targetDateText;
    hudElement.querySelector('#chrono-hud-tz-badge').textContent = config.timezoneLabel || 'Selected TZ';
    hudElement.querySelector('#chrono-hud-target-tag').textContent = config.tagName || config.text || 'Button';
    hudElement.querySelector('#chrono-hud-target-sel').textContent = config.selector || config.searchText || `(${config.coords?.x}, ${config.coords?.y})`;
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
    const resolved = resolveTarget(currentSchedule);
    if (resolved && resolved.el) {
      resolved.el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      resolved.el.classList.add('chrono-click-flash');
      setTimeout(() => resolved.el.classList.remove('chrono-click-flash'), 1000);
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
  // 6. 監聽擴充功能命令 (Runtime Messaging)
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
      executeScheduledClickWithPolling(payload);
      sendResponse({ success: true });
      return false;
    }

    if (action === 'GET_CONTENT_STATUS') {
      sendResponse({
        isScheduled: !!currentSchedule,
        schedule: currentSchedule,
        isTicketPlus: isTicketPlus
      });
      return false;
    }

    if (action === 'ACTIVATE_COORD_CAPTURE') {
      activateCoordCapture();
      sendResponse({ success: true });
      return false;
    }

    if (action === 'EXECUTE_MULTI_CLICK') {
      const { targets } = payload;
      if (!Array.isArray(targets) || targets.length === 0) {
        sendResponse({ success: false, error: '無點擊目標' });
        return false;
      }
      targets.forEach((t) => {
        setTimeout(() => {
          executeScheduledClickWithPolling({
            ...t,
            repeat: t.repeat || 1,
            interval: t.interval || 50,
            useCdp: t.useCdp !== undefined ? t.useCdp : isTicketPlus,
            useSystemMouse: t.useSystemMouse || false
          });
        }, t.delayMs || 0);
      });
      sendResponse({ success: true });
      return false;
    }

    if (action === 'CAPTCHA_FILL_ANSWER') {
      const { answer } = payload;
      const filled = tryCaptchaFill(answer);
      sendResponse({ success: filled });
      return false;
    }

    if (action === 'DETECT_CAPTCHA') {
      const detected = detectCaptchaPresence();
      sendResponse({ detected: !!detected, type: detected ? detected.type : null });
      return false;
    }

    if (action === 'EXECUTE_TP_AUTO_FLOW') {
      TicketPlusEngine.runAutoFlow(payload).then(res => {
        sendResponse(res);
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
      return true;
    }

    if (action === 'GET_TP_STATUS') {
      sendResponse({
        isTicketPlus: isTicketPlus || !!document.querySelector('.btn-ticketplus, #tpOrderSection'),
        settings: TicketPlusEngine.settings,
        detected: TicketPlusEngine.detectElements()
      });
      return false;
    }

    if (action === 'UPDATE_TP_SETTINGS') {
      TicketPlusEngine.updateSettings(payload);
      sendResponse({ success: true });
      return false;
    }
  });

  // ----------------------------------------------------
  // 7. 座標擷取模式 (Coordinate Capture Mode)
  // ----------------------------------------------------
  let coordCaptureActive = false;

  function activateCoordCapture() {
    if (coordCaptureActive) return;
    coordCaptureActive = true;

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
      background: 'rgba(15,23,42,0.95)',
      border: '1px solid #00f2fe',
      borderRadius: '8px',
      padding: '10px 20px',
      color: '#00f2fe',
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '0 0 20px rgba(0,242,254,0.4)',
      pointerEvents: 'none'
    });
    banner.textContent = '📍 點擊目標位置以擷取精準物理/頁面座標 (ESC 取消)';
    overlay.appendChild(banner);

    const coordDisplay = document.createElement('div');
    Object.assign(coordDisplay.style, {
      marginTop: '8px',
      background: 'rgba(0,0,0,0.8)',
      color: '#7dd3fc',
      padding: '4px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      pointerEvents: 'none'
    });
    coordDisplay.textContent = 'X: - , Y: - | 螢幕物理像素: -';
    overlay.appendChild(coordDisplay);

    document.body.appendChild(overlay);

    const onMouseMove = (e) => {
      coordDisplay.textContent = `視窗: (${e.clientX}, ${e.clientY}) | 螢幕物理像素: (${e.screenX}, ${e.screenY})`;
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        cleanup();
        chrome.runtime.sendMessage({ action: 'COORD_CAPTURE_CANCELLED' });
      }
    };

    const onClick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const pageX = e.clientX + window.scrollX;
      const pageY = e.clientY + window.scrollY;
      const screenX = e.screenX;
      const screenY = e.screenY;
      const dpr = window.devicePixelRatio || 1;
      const physicalX = Math.round(screenX * dpr);
      const physicalY = Math.round(screenY * dpr);

      cleanup();

      // 1. 直接持久化至 chrome.storage.local
      const domain = window.location.hostname || 'global';
      chrome.storage.local.get([`site_${domain}`], (res) => {
        const current = res[`site_${domain}`] || {};
        const updated = {
          ...current,
          useCoords: true,
          coords: {
            x: pageX,
            y: pageY,
            viewportX: e.clientX,
            viewportY: e.clientY,
            screenX: screenX,
            screenY: screenY,
            physicalX: physicalX,
            physicalY: physicalY,
            isPageCoords: true
          },
          targetPreview: `📍 頁面座標 (X:${pageX}, Y:${pageY})`
        };
        chrome.storage.local.set({ [`site_${domain}`]: updated });
      });

      // 2. 廣播訊息
      chrome.runtime.sendMessage({
        action: 'COORD_CAPTURED',
        payload: {
          x: pageX,
          y: pageY,
          viewportX: e.clientX,
          viewportY: e.clientY,
          screenX: screenX,
          screenY: screenY,
          physicalX: physicalX,
          physicalY: physicalY,
          isPageCoords: true
        }
      });

      // 3. 頁面 Toast 提示
      showToast(`📍 已擷取精準座標 (X:${pageX}, Y:${pageY})！\n設定已自動保存。`);

      const flash = document.createElement('div');
      Object.assign(flash.style, {
        position: 'fixed',
        left: `${e.clientX - 12}px`,
        top: `${e.clientY - 12}px`,
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
  // 8. 驗證碼輔助
  // ----------------------------------------------------

  function detectCaptchaPresence() {
    const recaptchaFrame = document.querySelector('iframe[src*="recaptcha"]');
    if (recaptchaFrame) return { type: 'reCAPTCHA', element: recaptchaFrame };

    const hcaptchaFrame = document.querySelector('iframe[src*="hcaptcha"]');
    if (hcaptchaFrame) return { type: 'hCaptcha', element: hcaptchaFrame };

    const turnstile = document.querySelector('iframe[src*="challenges.cloudflare"]');
    if (turnstile) return { type: 'Turnstile', element: turnstile };

    const imgCaptchaInput = document.querySelector(
      'input[name*="captcha" i], input[id*="captcha" i], input[placeholder*="驗證碼" i], input[placeholder*="captcha" i]'
    );
    if (imgCaptchaInput) return { type: 'TextCaptcha', element: imgCaptchaInput };

    return null;
  }

  function tryCaptchaFill(answer) {
    if (!answer) return false;
    const input = document.querySelector(
      'input[name*="captcha" i], input[id*="captcha" i], input[placeholder*="驗證碼" i], input[placeholder*="captcha" i], input[autocomplete="off"][type="text"]'
    );
    if (input) {
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

  // ----------------------------------------------------
  // 9. 遠大售票系統 (Ticket Plus) 專屬全自動選張數與確認引擎
  // ----------------------------------------------------
  const TicketPlusEngine = {
    settings: {
      enabled: true,
      targetCount: 1, // 1~4
      autoAgree: true,
      autoConfirm: true,
      autoTriggerCountdown: true
    },
    state: {
      quantitySelected: false,
      agreed: false,
      confirmed: false
    },
    observer: null,
    isExecuting: false,
    lastExecTime: 0,

    async init() {
      try {
        const stored = await new Promise(res => {
          chrome.storage.local.get(['tp_settings'], res);
        });
        if (stored && stored.tp_settings) {
          Object.assign(this.settings, stored.tp_settings);
        }
      } catch (e) {}

      const isTpContext = isTicketPlus || !!document.querySelector('.btn-ticketplus, #tpOrderSection');
      if (isTpContext) {
        console.log('[ChronoClicker TP] 🎫 遠大售票自動選張數與確認模組啟動，設定:', this.settings);
        this.startObserver();
        // 若當前 DOM 已存在購票元素，立即嘗試執行
        setTimeout(() => this.checkAndRunAutoFlow(), 300);
      }
    },

    resetState() {
      this.state.quantitySelected = false;
      this.state.agreed = false;
      this.state.confirmed = false;
    },

    updateSettings(newSettings) {
      if (!newSettings) return;
      Object.assign(this.settings, newSettings);
      try {
        chrome.storage.local.set({ tp_settings: this.settings });
      } catch (e) {}
      console.log('[ChronoClicker TP] 🎫 設定已更新:', this.settings);
    },

    startObserver() {
      if (this.observer) return;
      this.observer = new MutationObserver(() => {
        if (!this.settings.enabled) return;
        const now = Date.now();
        if (now - this.lastExecTime < 600) return; // 防抖

        this.checkAndRunAutoFlow();
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    },

    checkAndRunAutoFlow() {
      if (!this.settings.enabled || this.isExecuting) return;
      // 若已完成整個流程（確認已送出），不再重複執行
      if (this.state.confirmed) return;

      const elements = this.detectElements();
      if (elements.plusButtons.length > 0 || elements.countInputs.length > 0 || elements.selects.length > 0 || elements.confirmBtn) {
        this.runAutoFlow({ silentIfAlreadyDone: true });
      }
    },

    detectElements() {
      const allButtons = Array.from(document.querySelectorAll('button, .v-btn, [role="button"]'));

      // 檢查某元素所在區塊是否標記為「已售完」或「完售」
      const isSoldOutRow = (el) => {
        const container = el.closest('.session-item, tr, .ticket-row, .v-card, .v-expansion-panel') || el.parentElement;
        if (!container) return false;
        const text = (container.textContent || '').replace(/\s+/g, '');
        return /(?:已售完|完售|已額滿|缺票|暫停販售|soldout)/i.test(text);
      };

      // 1. 加號按鈕 (Stepper Plus)
      const plusButtons = allButtons.filter(btn => {
        if (btn.disabled && !btn.classList.contains('v-btn--disabled')) return false;
        if (btn.getAttribute('aria-disabled') === 'true') return false;
        const text = (btn.innerText || btn.textContent || '').trim();
        const hasPlusIcon = !!btn.querySelector('.mdi-plus, i[class*="plus"], [class*="icon-plus"], svg[data-icon="plus"]');
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        const isPlus = hasPlusIcon || text === '+' || text === '＋' || ariaLabel.includes('plus') || ariaLabel.includes('增加') || ariaLabel.includes('加');
        return isPlus;
      });

      // 依可售狀態排序：非售完之票區優先於售完票區
      plusButtons.sort((a, b) => {
        const aSold = isSoldOutRow(a) ? 1 : 0;
        const bSold = isSoldOutRow(b) ? 1 : 0;
        return aSold - bSold;
      });

      // 2. 減號按鈕 (Stepper Minus)
      const minusButtons = allButtons.filter(btn => {
        const text = (btn.innerText || btn.textContent || '').trim();
        const hasMinusIcon = !!btn.querySelector('.mdi-minus, i[class*="minus"], [class*="icon-minus"]');
        const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
        return hasMinusIcon || text === '-' || text === '－' || ariaLabel.includes('minus') || ariaLabel.includes('減少');
      });

      // 3. 張數輸入框或下拉選單
      const countInputs = Array.from(document.querySelectorAll('input[type="number"], input[aria-label*="張數"], input[placeholder*="張數"], input[name*="count"], input[name*="quantity"]'))
        .filter(inp => !isSoldOutRow(inp));
      const selects = Array.from(document.querySelectorAll('select')).filter(sel => !isSoldOutRow(sel));

      // 4. 同意條款 Checkbox
      const agreementCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(cb => {
        const parentText = (cb.closest('label, div, .v-checkbox, .v-selection-control')?.textContent || '').toLowerCase();
        return parentText.includes('同意') || parentText.includes('服務條款') || parentText.includes('會員條款') || parentText.includes('閱讀') || parentText.includes('agree');
      });

      // 5. 確認按鈕
      const confirmKeywords = ['下一步', '確認張數', '確定', '同意並送出', '確定購票', '前往結帳', '立即結帳', '確認', '送出'];
      let confirmBtn = null;
      for (const kw of confirmKeywords) {
        const found = allButtons.find(btn => {
          if (plusButtons.includes(btn) || minusButtons.includes(btn)) return false;
          const text = extractButtonText(btn).replace(/\s+/g, '');
          return text.includes(kw);
        });
        if (found) {
          confirmBtn = found;
          break;
        }
      }

      return {
        plusButtons,
        minusButtons,
        countInputs,
        selects,
        agreementCheckboxes,
        confirmBtn
      };
    },

    getCurrentQuantity(plusBtn) {
      if (!plusBtn) return 0;
      // 限縮在 Stepper 或張數控制元件內部，避免誤讀活動日期或票價
      const stepper = plusBtn.closest('.quantity-control, .stepper, .v-input, [class*="quantity"], [class*="stepper"]') || plusBtn.parentElement;
      if (stepper) {
        const input = stepper.querySelector('input');
        if (input && input.value !== undefined && input.value !== '') {
          const v = parseInt(input.value, 10);
          if (!isNaN(v) && v >= 0 && v <= 20) return v;
        }
        // 若無 input，尋找 Stepper 內部純數字元素（嚴格限制 0~20，排除價格與日期）
        const candidates = Array.from(stepper.querySelectorAll('span, div, p')).filter(el => {
          return !el.closest('button') && !el.classList.contains('v-btn__content');
        });
        for (const el of candidates) {
          const t = el.textContent.trim();
          if (/^\d{1,2}$/.test(t)) {
            const v = parseInt(t, 10);
            if (!isNaN(v) && v >= 0 && v <= 20) return v;
          }
        }
      }
      return 0;
    },

    async selectQuantity(targetCount) {
      targetCount = parseInt(targetCount, 10) || this.settings.targetCount || 1;
      let success = false;
      const detected = this.detectElements();

      // 優先方式 A: Stepper Plus 按鈕
      if (detected.plusButtons.length > 0) {
        const plusBtn = detected.plusButtons[0];
        forceUnlockElement(plusBtn);
        const current = this.getCurrentQuantity(plusBtn);
        const needed = Math.max(0, targetCount - current);

        console.log(`[ChronoClicker TP] 找到 Stepper + 按鈕，當前張數: ${current}, 目標: ${targetCount}, 需點擊 ${needed} 次`);
        for (let i = 0; i < needed; i++) {
          await this.triggerClick(plusBtn);
          await new Promise(r => setTimeout(r, 90));
        }
        success = true;
      }

      // 方式 B: 原生 Select 下拉選單
      if (!success && detected.selects.length > 0) {
        for (const sel of detected.selects) {
          const opt = Array.from(sel.options).find(o => o.value == targetCount || o.text.trim() == String(targetCount));
          if (opt) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            sel.dispatchEvent(new Event('input', { bubbles: true }));
            console.log(`[ChronoClicker TP] 原生 Select 已選擇: ${targetCount}`);
            success = true;
            break;
          }
        }
      }

      // 方式 C: 數字輸入框
      if (!success && detected.countInputs.length > 0) {
        const inp = detected.countInputs[0];
        forceUnlockElement(inp);
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (nativeSetter) {
          nativeSetter.call(inp, targetCount);
        } else {
          inp.value = targetCount;
        }
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        inp.dispatchEvent(new Event('change', { bubbles: true }));
        console.log(`[ChronoClicker TP] 數字輸入框已填入: ${targetCount}`);
        success = true;
      }

      if (success) {
        this.state.quantitySelected = true;
      }
      return success;
    },

    autoAgree() {
      let agreed = false;
      const detected = this.detectElements();
      for (const cb of detected.agreementCheckboxes) {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          cb.dispatchEvent(new Event('input', { bubbles: true }));
          agreed = true;
        }
      }

      // 檢測未勾選的任何 checkbox 且鄰近有同意文字
      const allCheckboxes = Array.from(document.querySelectorAll('input[type="checkbox"]:not(:checked)'));
      for (const cb of allCheckboxes) {
        const parent = cb.closest('label, div');
        const text = (parent ? parent.textContent : '').toLowerCase();
        if (text.includes('同意') || text.includes('服務條款') || text.includes('我已詳細閱讀') || text.includes('agree')) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
          cb.dispatchEvent(new Event('input', { bubbles: true }));
          agreed = true;
        }
      }
      if (agreed) this.state.agreed = true;
      return agreed;
    },

    async clickConfirm() {
      const detected = this.detectElements();
      if (detected.confirmBtn) {
        const btn = detected.confirmBtn;
        forceUnlockElement(btn);
        console.log(`[ChronoClicker TP] 找到確認按鈕: "${extractButtonText(btn)}" 觸發點擊`);
        await this.triggerClick(btn);
        this.state.confirmed = true;
        return true;
      }
      return false;
    },

    /**
     * 防破壞點擊派發器：
     * 優先派發 CDP 原生 isTrusted: true 事件；
     * 僅在 CDP 不可用或非 Ticket Plus 時才備用派發 DOM 事件，徹底杜絕重複點擊與反爬蟲警報！
     */
    async triggerClick(el) {
      if (!el) return;
      forceUnlockElement(el);
      const coords = getElementCoordinates(el);

      el.classList.add('chrono-click-flash');
      setTimeout(() => el.classList.remove('chrono-click-flash'), 600);

      let cdpHandled = false;
      try {
        const cdpRes = await new Promise(resolve => {
          chrome.runtime.sendMessage({
            action: 'DISPATCH_CDP_CLICK',
            payload: { x: coords.viewportX, y: coords.viewportY, repeat: 1 }
          }, (res) => {
            if (chrome.runtime.lastError || !res || !res.success) {
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });
        cdpHandled = cdpRes;
      } catch (e) {
        cdpHandled = false;
      }

      // 若 CDP 成功觸發，嚴格終止！不可再派發合成 DOM 事件，避免 Ticket Plus 收到兩次點擊
      if (!cdpHandled) {
        try {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          if (typeof el.click === 'function') el.click();
        } catch (e) {}
      }
    },

    async runAutoFlow(options = {}) {
      if (this.isExecuting) return { success: false, reason: 'already_running' };
      if (options.forceReset) {
        this.resetState();
      }
      // 若非強制重設且已經確認完成，避免重複提交
      if (this.state.confirmed && !options.forceReset) {
        return { success: true, alreadyDone: true };
      }

      this.isExecuting = true;
      this.lastExecTime = Date.now();

      const targetCount = options.targetCount !== undefined ? options.targetCount : this.settings.targetCount;
      const doAgree = options.autoAgree !== undefined ? options.autoAgree : this.settings.autoAgree;
      const doConfirm = options.autoConfirm !== undefined ? options.autoConfirm : this.settings.autoConfirm;

      try {
        console.log(`[ChronoClicker TP] ⚡ 執行自動選票：目標張數 ${targetCount}，同意條款: ${doAgree}，自動確定: ${doConfirm}`);

        // 1. 選取張數（若尚未選取或強制重跑）
        let qtySelected = false;
        if (!this.state.quantitySelected || options.forceReset) {
          qtySelected = await this.selectQuantity(targetCount);
          await new Promise(r => setTimeout(r, 100));
        }

        // 2. 勾選條款
        if (doAgree) {
          this.autoAgree();
          await new Promise(r => setTimeout(r, 80));
        }

        // 3. 點擊確定
        let confirmed = false;
        if (doConfirm && (!this.state.confirmed || options.forceReset)) {
          confirmed = await this.clickConfirm();
        }

        if (qtySelected || confirmed) {
          showToast(`🎫 Ticket Plus 遠大售票全自動：\n✅ 已選 ${targetCount} 張票 ${doAgree ? '✓ 同意條款' : ''} ${confirmed ? '✓ 點擊確定' : ''}`);
        }

        return {
          success: true,
          quantitySelected: qtySelected || this.state.quantitySelected,
          confirmed: confirmed || this.state.confirmed,
          targetCount
        };
      } finally {
        setTimeout(() => {
          this.isExecuting = false;
        }, 500);
      }
    }
  };

  // 初始化 Ticket Plus 模組
  TicketPlusEngine.init();

})();
