/**
 * ChronoClicker - Popup Logic v1.1
 * 功能：
 *   - 世界時區即時渲染、原子鐘校準
 *   - 單目標定時點擊（原有功能 + 座標 Bug 修正說明）
 *   - 多目標序列點擊（功能 A，可拖曳排序，最多 10 個）
 *   - AI 驗證碼自動識別（功能 B，Gemini/GPT-4o/Claude）
 */

document.addEventListener('DOMContentLoaded', async () => {
  // ────────────────────────────────────────────────
  // DOM 元素引用
  // ────────────────────────────────────────────────
  const tzSelect              = document.getElementById('tzSelect');
  const liveClockTime         = document.getElementById('liveClockTime');
  const liveClockMs           = document.getElementById('liveClockMs');
  const liveClockDate         = document.getElementById('liveClockDate');
  const syncStatusBadge       = document.getElementById('syncStatusBadge');
  const syncStatusText        = document.getElementById('syncStatusText');
  const currentDomainBadge    = document.getElementById('currentDomainBadge');

  const targetDateInput       = document.getElementById('targetDate');
  const targetHourInput       = document.getElementById('targetHour');
  const targetMinuteInput     = document.getElementById('targetMinute');
  const targetSecondInput     = document.getElementById('targetSecond');
  const targetMsInput         = document.getElementById('targetMs');

  const btnPlus10s            = document.getElementById('btnPlus10s');
  const btnPlus30s            = document.getElementById('btnPlus30s');
  const btnPlus1m             = document.getElementById('btnPlus1m');
  const btnNextHour           = document.getElementById('btnNextHour');

  const btnStartPicker        = document.getElementById('btnStartPicker');
  const btnTestClick          = document.getElementById('btnTestClick');
  const targetPreviewText     = document.getElementById('targetPreviewText');

  const targetSelectorInput   = document.getElementById('targetSelectorInput');
  const targetXpathInput      = document.getElementById('targetXpathInput');
  const targetSearchText      = document.getElementById('targetSearchText');
  const useCoordsToggle       = document.getElementById('useCoordsToggle');
  const coordXInput           = document.getElementById('coordX');
  const coordYInput           = document.getElementById('coordY');
  const btnCaptureCoords      = document.getElementById('btnCaptureCoords');

  const useShadowDomToggle    = document.getElementById('useShadowDomToggle');
  const useIframeSearchToggle = document.getElementById('useIframeSearchToggle');
  const useCoordFallbackToggle= document.getElementById('useCoordFallbackToggle');

  const repeatCountInput      = document.getElementById('repeatCount');
  const repeatIntervalInput   = document.getElementById('repeatInterval');
  const useCdpToggle          = document.getElementById('useCdpToggle');
  const useSystemMouseToggle  = document.getElementById('useSystemMouseToggle');
  const systemMouseStatusBadge= document.getElementById('systemMouseStatusBadge');
  const btnHelpMouseServer    = document.getElementById('btnHelpMouseServer');
  const mouseModal            = document.getElementById('mouseModal');
  const btnCloseMouseModal    = document.getElementById('btnCloseMouseModal');
  const btnTestMouseServer    = document.getElementById('btnTestMouseServer');
  const pollDurationInput     = document.getElementById('pollDurationInput');
  const tpBadge               = document.getElementById('tpBadge');

  const btnStartCountdown     = document.getElementById('btnStartCountdown');
  const btnStopCountdown      = document.getElementById('btnStopCountdown');
  const statusBanner          = document.getElementById('statusBanner');
  const statusBannerText      = document.getElementById('statusBannerText');

  // 多目標面板
  const btnAddTarget          = document.getElementById('btnAddTarget');
  const multiTargetList       = document.getElementById('multiTargetList');
  const multiTargetEmpty      = document.getElementById('multiTargetEmpty');
  const btnStartMultiCountdown= document.getElementById('btnStartMultiCountdown');
  const btnStopMultiCountdown = document.getElementById('btnStopMultiCountdown');

  // AI 設定面板
  const aiModelSelect         = document.getElementById('aiModelSelect');
  const aiApiKeyInput         = document.getElementById('aiApiKey');
  const btnToggleApiKey       = document.getElementById('btnToggleApiKey');
  const aiPromptInput         = document.getElementById('aiPrompt');
  const btnSaveAiSettings     = document.getElementById('btnSaveAiSettings');
  const btnDetectSolveCaptcha = document.getElementById('btnDetectSolveCaptcha');
  const captchaResultBox      = document.getElementById('captchaResultBox');
  const captchaTypeText       = document.getElementById('captchaTypeText');
  const captchaAnswerText     = document.getElementById('captchaAnswerText');
  const btnFillCaptchaAnswer  = document.getElementById('btnFillCaptchaAnswer');

  // ────────────────────────────────────────────────
  // 狀態
  // ────────────────────────────────────────────────
  let currentTab = null;
  let currentDomain = '';
  let selectedTimezone = 'Asia/Taipei';
  let targetElementInfo = null;
  let multiTargets = []; // [{id, selector, xpath, searchText, coords, delayMs, repeat, interval, useCdp, label}]
  let lastCaptchaAnswer = '';
  let coordsArePageSpace = false; // 記錄座標是否為頁面絕對座標

  // ────────────────────────────────────────────────
  // 主分頁切換
  // ────────────────────────────────────────────────
  document.querySelectorAll('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.main-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelId = `mainpanel-${tab.dataset.mainTab}`;
      document.getElementById(panelId)?.classList.add('active');
    });
  });

  // ────────────────────────────────────────────────
  // 1. 時區下拉選單
  // ────────────────────────────────────────────────
  TimeSync.TIMEZONES.forEach((tz) => {
    const opt = document.createElement('option');
    opt.value = tz.id;
    opt.textContent = tz.name;
    tzSelect.appendChild(opt);
  });
  tzSelect.value = selectedTimezone;
  tzSelect.addEventListener('change', (e) => {
    selectedTimezone = e.target.value;
    saveCurrentConfig();
  });

  // 備案策略 Tab 切換邏輯
  document.querySelectorAll('.ftab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ftab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelId = `fpanel-${tab.dataset.tab}`;
      document.getElementById(panelId)?.classList.add('active');
      saveCurrentConfig();
    });
  });

  // 座標擷取
  if (btnCaptureCoords) {
    btnCaptureCoords.addEventListener('click', async () => {
      if (!currentTab || !currentTab.id) return;
      statusBannerText.textContent = '📍 請切換至目標網頁，點擊想要的位置以擷取座標...';
      chrome.tabs.sendMessage(currentTab.id, { action: 'ACTIVATE_COORD_CAPTURE' }, () => {
        if (chrome.runtime.lastError) {
          statusBannerText.textContent = '⚠️ 請先重新整理目標網頁';
          return;
        }
        window.close();
      });
    });
  }

  // ────────────────────────────────────────────────
  // 2. 時間同步
  // ────────────────────────────────────────────────
  await TimeSync.init();
  updateSyncBadge();
  if (!TimeSync.isSynced) triggerTimeSync();

  syncStatusBadge.addEventListener('click', () => triggerTimeSync());

  function updateSyncBadge() {
    if (TimeSync.isSynced) {
      syncStatusBadge.className = 'sync-status synced';
      syncStatusText.textContent = `±${TimeSync.offset}ms (延遲: ${TimeSync.rtt}ms)`;
    } else {
      syncStatusBadge.className = 'sync-status';
      syncStatusText.textContent = '本機時鐘 (點擊同步)';
    }
  }

  function triggerTimeSync() {
    syncStatusText.textContent = '校準原子鐘...';
    syncStatusBadge.className = 'sync-status';
    chrome.runtime.sendMessage({ action: 'SYNC_TIME' }, (res) => {
      if (res && res.success) {
        TimeSync.offset = res.offset;
        TimeSync.rtt = res.rtt;
        TimeSync.isSynced = true;
      }
      updateSyncBadge();
    });
  }

  // 實體滑鼠伺服器狀態檢查與 Modal 綁定
  async function checkMouseServer() {
    if (!systemMouseStatusBadge) return;
    systemMouseStatusBadge.textContent = '連線檢測中...';
    systemMouseStatusBadge.className = 'badge-tag';
    chrome.runtime.sendMessage({ action: 'CHECK_SYSTEM_MOUSE_STATUS' }, (res) => {
      if (res && res.available) {
        systemMouseStatusBadge.textContent = '🟢 實體滑鼠已連線';
        systemMouseStatusBadge.className = 'badge-tag online';
        // 若在 Ticket Plus 售票網站且伺服器在線，自動啟用實體滑鼠
        if (currentDomain && currentDomain.includes('ticketplus.com.tw') && useSystemMouseToggle) {
          useSystemMouseToggle.checked = true;
          saveCurrentConfig();
        }
      } else {
        systemMouseStatusBadge.textContent = '⚪ 未啟動 (點擊重測)';
        systemMouseStatusBadge.className = 'badge-tag offline';
      }
    });
  }
  checkMouseServer();

  if (systemMouseStatusBadge) systemMouseStatusBadge.addEventListener('click', checkMouseServer);
  if (btnTestMouseServer) btnTestMouseServer.addEventListener('click', () => {
    checkMouseServer();
    setTimeout(() => {
      alert(systemMouseStatusBadge.textContent.includes('已連線') ? '🎉 本機實體滑鼠伺服器連線成功！' : '⚠️ 尚未偵測到伺服器，請先執行 start_mouse_server.bat');
    }, 600);
  });
  if (btnHelpMouseServer) btnHelpMouseServer.addEventListener('click', () => {
    if (mouseModal) mouseModal.style.display = 'flex';
  });
  if (btnCloseMouseModal) btnCloseMouseModal.addEventListener('click', () => {
    if (mouseModal) mouseModal.style.display = 'none';
  });

  // ────────────────────────────────────────────────
  // 3. 當前分頁
  // ────────────────────────────────────────────────
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url) {
      currentTab = tab;
      try {
        const urlObj = new URL(tab.url);
        currentDomain = urlObj.hostname || 'global';
      } catch {
        currentDomain = 'unknown';
      }
      currentDomainBadge.textContent = currentDomain;

      const isTp = currentDomain.includes('ticketplus.com.tw');
      if (isTp) {
        if (tpBadge) tpBadge.style.display = 'inline-block';
        if (useCdpToggle) useCdpToggle.checked = true;
      }

      await loadConfigForDomain(currentDomain);

      chrome.tabs.sendMessage(tab.id, { action: 'GET_CONTENT_STATUS' }, (res) => {
        if (chrome.runtime.lastError) return;
        if (res && res.isScheduled) {
          statusBanner.className = 'status-banner active';
          statusBannerText.textContent = '⏱️ 該網頁正有倒數任務進行中';
        }
      });
    }
  } catch (err) {
    console.warn('[Popup] Tab query error:', err);
  }

  // ────────────────────────────────────────────────
  // 4. 即時時鐘
  // ────────────────────────────────────────────────
  function renderClock() {
    const accurateNow = TimeSync.getAccurateNow();
    const formatted = TimeSync.formatInTimezone(accurateNow, selectedTimezone);
    liveClockTime.childNodes[0].nodeValue = formatted.timeString;
    liveClockMs.textContent = `.${formatted.msString}`;
    liveClockDate.textContent = `${formatted.dateString} (${selectedTimezone})`;
    requestAnimationFrame(renderClock);
  }
  requestAnimationFrame(renderClock);

  // ────────────────────────────────────────────────
  // 5. 快速時間推算
  // ────────────────────────────────────────────────
  function addTimeOffset(secondsToAdd, roundToNextHour = false) {
    const accurateNow = TimeSync.getAccurateNow();
    let targetTime = accurateNow + secondsToAdd * 1000;
    if (roundToNextHour) {
      const d = new Date(accurateNow);
      d.setHours(d.getHours() + 1, 0, 0, 0);
      targetTime = d.getTime();
    }
    const fmt = TimeSync.formatInTimezone(targetTime, selectedTimezone);
    const [year, month, day] = fmt.dateString.split('-');
    const [h, m, s] = fmt.timeString.split(':');
    targetDateInput.value = `${year}-${month}-${day}`;
    targetHourInput.value = h;
    targetMinuteInput.value = m;
    targetSecondInput.value = s;
    targetMsInput.value = '000';
    saveCurrentConfig();
  }

  btnPlus10s.addEventListener('click', () => addTimeOffset(10));
  btnPlus30s.addEventListener('click', () => addTimeOffset(30));
  btnPlus1m.addEventListener('click', () => addTimeOffset(60));
  btnNextHour.addEventListener('click', () => addTimeOffset(0, true));

  if (!targetHourInput.value) addTimeOffset(60);

  // ────────────────────────────────────────────────
  // 6. 元素選取器
  // ────────────────────────────────────────────────
  btnStartPicker.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) return;
    statusBannerText.textContent = '🎯 請切換至網頁選取元素，點擊選取或按 ESC 取消...';
    chrome.tabs.sendMessage(currentTab.id, { action: 'ACTIVATE_PICKER' }, (res) => {
      if (chrome.runtime.lastError) {
        statusBannerText.textContent = '⚠️ 請重新整理該網頁後再試';
        return;
      }
      window.close();
    });
  });

  // 監聽選取結果訊息
  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'ELEMENT_PICKED') {
      const p = req.payload;
      targetElementInfo = p;
      targetPreviewText.textContent = `${p.tagName.toUpperCase()}${p.id ? '#' + p.id : ''} "${p.text || ''}"`;
      if (targetSelectorInput) targetSelectorInput.value = p.selector || '';
      if (targetXpathInput && p.xpath) targetXpathInput.value = p.xpath;
      if (targetSearchText && p.searchText) targetSearchText.value = p.searchText;
      if (p.coords) {
        if (coordXInput) coordXInput.value = p.coords.x;
        if (coordYInput) coordYInput.value = p.coords.y;
        coordsArePageSpace = p.coords.isPageCoords === true;
      }
      if (p.isTicketPlus) {
        if (useCdpToggle) useCdpToggle.checked = true;
        if (tpBadge) tpBadge.style.display = 'inline-block';
      }
      saveCurrentConfig();
    }

    if (req.action === 'COORD_CAPTURED') {
      const { x, y, isPageCoords } = req.payload;
      if (coordXInput) coordXInput.value = x;
      if (coordYInput) coordYInput.value = y;
      if (useCoordsToggle) useCoordsToggle.checked = true;
      coordsArePageSpace = isPageCoords === true;

      document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ftab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('.ftab[data-tab="coord"]')?.classList.add('active');
      document.getElementById('fpanel-coord')?.classList.add('active');

      targetPreviewText.textContent = `📍 頁面座標 (X:${x}, Y:${y})`;
      statusBannerText.textContent = `✅ 已擷取座標 X:${x}, Y:${y}`;
      saveCurrentConfig();
    }
  });

  // ────────────────────────────────────────────────
  // 7. 自動儲存
  // ────────────────────────────────────────────────
  [
    targetDateInput, targetHourInput, targetMinuteInput, targetSecondInput, targetMsInput,
    targetSelectorInput, targetXpathInput, targetSearchText,
    useCoordsToggle, coordXInput, coordYInput,
    useShadowDomToggle, useIframeSearchToggle, useCoordFallbackToggle,
    repeatCountInput, repeatIntervalInput, useCdpToggle,
    useSystemMouseToggle, pollDurationInput
  ].filter(Boolean).forEach(el => {
    el.addEventListener('input', saveCurrentConfig);
    el.addEventListener('change', saveCurrentConfig);
  });

  // ────────────────────────────────────────────────
  // 8. 立即測試點擊
  // ────────────────────────────────────────────────
  btnTestClick.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) return;
    const config = collectCurrentConfig();
    if (config.useCdp || (currentDomain && currentDomain.includes('ticketplus.com.tw'))) {
      await new Promise(r => chrome.runtime.sendMessage({ action: 'PRE_ATTACH_CDP', payload: { tabId: currentTab.id } }, r));
    }
    chrome.tabs.sendMessage(currentTab.id, { action: 'TEST_CLICK', payload: config }, () => {
      if (chrome.runtime.lastError) {
        alert('無法發送測試點擊，請確認該網頁已重新整理且允許擴充功能。');
      } else {
        statusBannerText.textContent = '⚡ 已在當前網頁觸發測試點擊！';
      }
    });
  });

  // ────────────────────────────────────────────────
  // 9. 單目標定時倒數
  // ────────────────────────────────────────────────
  btnStartCountdown.addEventListener('click', () => {
    if (!currentTab || !currentTab.id) {
      alert('未找到可操作的網頁分頁！');
      return;
    }
    const config = collectCurrentConfig();
    if (!config.selector && !config.xpath && !config.searchText && (!config.coords || !config.coords.x)) {
      alert('請先點擊「🎯 選擇網頁元素」或手動輸入目標 Selector！');
      return;
    }

    const targetEpoch = TimeSync.parseTargetToEpoch(
      config.date, `${config.hour}:${config.minute}:${config.second}`, config.ms, selectedTimezone
    );
    const nowEpoch = TimeSync.getAccurateNow();
    const diff = targetEpoch - nowEpoch;
    if (diff <= 0) {
      alert(`設定的目標時間已過去！\n目標: ${new Date(targetEpoch).toISOString()}\n目前: ${new Date(nowEpoch).toISOString()}`);
      return;
    }

    const payload = {
      ...config,
      targetEpoch,
      offset: TimeSync.offset,
      formattedTarget: `${config.date} ${config.hour}:${config.minute}:${config.second}.${config.ms}`,
      timezoneLabel: tzSelect.options[tzSelect.selectedIndex].text
    };

    if (config.useCdp || (currentDomain && currentDomain.includes('ticketplus.com.tw'))) {
      chrome.runtime.sendMessage({ action: 'PRE_ATTACH_CDP', payload: { tabId: currentTab.id } });
    }

    chrome.tabs.sendMessage(currentTab.id, { action: 'START_COUNTDOWN', payload }, () => {
      if (chrome.runtime.lastError) {
        alert('啟動失敗：請先重新整理目標網頁以載入點擊腳本！');
      } else {
        statusBanner.className = 'status-banner active';
        statusBannerText.textContent = `🚀 已啟動！剩餘 ${(diff / 1000).toFixed(1)} 秒`;
      }
    });
    saveCurrentConfig();
  });

  btnStopCountdown.addEventListener('click', () => {
    if (!currentTab || !currentTab.id) return;
    chrome.runtime.sendMessage({ action: 'DETACH_CDP', payload: { tabId: currentTab.id } });
    chrome.tabs.sendMessage(currentTab.id, { action: 'STOP_COUNTDOWN' }, () => {
      statusBanner.className = 'status-banner';
      statusBannerText.textContent = '⏹ 倒數已終止';
    });
  });

  // ────────────────────────────────────────────────
  // 功能 A：多目標序列點擊
  // ────────────────────────────────────────────────
  btnAddTarget.addEventListener('click', () => {
    if (multiTargets.length >= 10) {
      statusBannerText.textContent = '⚠️ 最多支援 10 個點擊目標';
      return;
    }
    const id = Date.now();
    const newTarget = {
      id,
      label: `目標 ${multiTargets.length + 1}`,
      selector: '',
      xpath: '',
      searchText: '',
      coords: { x: 0, y: 0 },
      delayMs: multiTargets.length * 200,
      repeat: 1,
      interval: 50,
      useCdp: false,
      useCoordFallback: true
    };
    multiTargets.push(newTarget);
    renderMultiTargetList();
    saveMultiTargets();
  });

  function renderMultiTargetList() {
    multiTargetList.innerHTML = '';
    if (multiTargets.length === 0) {
      multiTargetEmpty.style.display = 'block';
      return;
    }
    multiTargetEmpty.style.display = 'none';

    multiTargets.forEach((t, idx) => {
      const item = document.createElement('div');
      item.className = 'multi-target-item';
      item.dataset.id = t.id;
      item.draggable = true;

      item.innerHTML = `
        <div class="multi-target-item-header">
          <span class="drag-handle" title="拖曳調整順序">⠿</span>
          <span class="target-index-badge">${idx + 1}</span>
          <span class="target-item-label">${escapeHtml(t.label || `目標 ${idx + 1}`)}</span>
          <button class="btn-remove-target" data-id="${t.id}" title="移除此目標">✕</button>
        </div>
        <div class="target-item-inputs">
          <div class="target-input-group">
            <label>CSS Selector / XPath / 文字</label>
            <input type="text" class="ti-selector" value="${escapeAttr(t.selector || t.xpath || t.searchText)}"
              placeholder="#btn, //button, 文字內容" data-id="${t.id}">
          </div>
          <div class="target-input-group">
            <label>標籤名稱（選填）</label>
            <input type="text" class="ti-label" value="${escapeAttr(t.label)}"
              placeholder="加入購物車" data-id="${t.id}">
          </div>
        </div>
        <div class="target-delay-row">
          <span>T＋</span>
          <input type="number" class="ti-delay" min="0" max="30000" value="${t.delayMs}" data-id="${t.id}">
          <span>ms 觸發 &nbsp;|&nbsp; 連點</span>
          <input type="number" class="ti-repeat" min="1" max="20" value="${t.repeat}" style="width:44px;" data-id="${t.id}">
          <span>次</span>
        </div>
      `;

      // 移除按鈕
      item.querySelector('.btn-remove-target').addEventListener('click', (e) => {
        const removeId = parseInt(e.currentTarget.dataset.id);
        multiTargets = multiTargets.filter(x => x.id !== removeId);
        renderMultiTargetList();
        saveMultiTargets();
      });

      // 欄位變更
      item.querySelector('.ti-selector').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const tid = parseInt(e.target.dataset.id);
        const tgt = multiTargets.find(x => x.id === tid);
        if (!tgt) return;
        // 智慧判斷類型
        if (val.startsWith('//') || val.startsWith('(//')) {
          tgt.xpath = val; tgt.selector = ''; tgt.searchText = '';
        } else if (val.startsWith('#') || val.startsWith('.') || val.includes('[') || val.includes('>')) {
          tgt.selector = val; tgt.xpath = ''; tgt.searchText = '';
        } else {
          tgt.searchText = val; tgt.selector = ''; tgt.xpath = '';
        }
        saveMultiTargets();
      });

      item.querySelector('.ti-label').addEventListener('input', (e) => {
        const tid = parseInt(e.target.dataset.id);
        const tgt = multiTargets.find(x => x.id === tid);
        if (tgt) { tgt.label = e.target.value; saveMultiTargets(); }
      });

      item.querySelector('.ti-delay').addEventListener('input', (e) => {
        const tid = parseInt(e.target.dataset.id);
        const tgt = multiTargets.find(x => x.id === tid);
        if (tgt) { tgt.delayMs = parseInt(e.target.value) || 0; saveMultiTargets(); }
      });

      item.querySelector('.ti-repeat').addEventListener('input', (e) => {
        const tid = parseInt(e.target.dataset.id);
        const tgt = multiTargets.find(x => x.id === tid);
        if (tgt) { tgt.repeat = parseInt(e.target.value) || 1; saveMultiTargets(); }
      });

      // HTML5 Drag & Drop 排序
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', t.id.toString());
        item.style.opacity = '0.5';
      });
      item.addEventListener('dragend', () => { item.style.opacity = ''; });
      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });
      item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const fromId = parseInt(e.dataTransfer.getData('text/plain'));
        if (fromId === t.id) return;
        const fromIdx = multiTargets.findIndex(x => x.id === fromId);
        const toIdx = multiTargets.findIndex(x => x.id === t.id);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = multiTargets.splice(fromIdx, 1);
        multiTargets.splice(toIdx, 0, moved);
        renderMultiTargetList();
        saveMultiTargets();
      });

      multiTargetList.appendChild(item);
    });
  }

  // 啟動多目標倒數
  btnStartMultiCountdown.addEventListener('click', () => {
    if (!currentTab || !currentTab.id) {
      alert('未找到可操作的網頁分頁！');
      return;
    }
    if (multiTargets.length === 0) {
      alert('請先在「多點擊」面板新增至少一個目標！');
      return;
    }

    const config = collectCurrentConfig();
    const targetEpoch = TimeSync.parseTargetToEpoch(
      config.date, `${config.hour}:${config.minute}:${config.second}`, config.ms, selectedTimezone
    );
    const nowEpoch = TimeSync.getAccurateNow();
    const diff = targetEpoch - nowEpoch;
    if (diff <= 0) {
      alert('請先在主面板設定未來的目標時間！');
      return;
    }

    // 按 delayMs 排序後發送，並確保頂層之 useCdp 與 useSystemMouse 參數灌注至子目標
    const sortedTargets = multiTargets.map(t => ({
      ...t,
      useCdp: t.useCdp !== undefined ? t.useCdp : config.useCdp,
      useSystemMouse: t.useSystemMouse !== undefined ? t.useSystemMouse : config.useSystemMouse
    })).sort((a, b) => (a.delayMs || 0) - (b.delayMs || 0));

    chrome.runtime.sendMessage({
      action: 'SCHEDULE_MULTI_CLICK',
      payload: {
        tabId: currentTab.id,
        targets: sortedTargets,
        targetEpoch,
        offset: TimeSync.offset,
        useCdp: config.useCdp,
        useSystemMouse: config.useSystemMouse
      }
    }, (res) => {
      if (chrome.runtime.lastError || !res || !res.success) {
        statusBannerText.textContent = '❌ 多目標排程失敗';
        return;
      }
      statusBanner.className = 'status-banner active';
      statusBannerText.textContent = `🚀 多目標已排程！共 ${sortedTargets.length} 個目標，${(diff / 1000).toFixed(1)} 秒後觸發`;
    });
  });

  btnStopMultiCountdown.addEventListener('click', () => {
    if (!currentTab || !currentTab.id) return;
    chrome.runtime.sendMessage({ action: 'DETACH_CDP', payload: { tabId: currentTab.id } });
    chrome.tabs.sendMessage(currentTab.id, { action: 'STOP_COUNTDOWN' }, () => {
      statusBanner.className = 'status-banner';
      statusBannerText.textContent = '⏹ 多目標倒數已終止';
    });
  });

  // ────────────────────────────────────────────────
  // 功能 B：AI 驗證碼識別
  // ────────────────────────────────────────────────

  // 顯示/隱藏 API Key
  btnToggleApiKey.addEventListener('click', () => {
    const isHidden = aiApiKeyInput.type === 'password';
    aiApiKeyInput.type = isHidden ? 'text' : 'password';
    btnToggleApiKey.textContent = isHidden ? '🙈' : '👁';
  });

  // 儲存 AI 設定
  btnSaveAiSettings.addEventListener('click', async () => {
    const model = aiModelSelect.value;
    const apiKey = aiApiKeyInput.value.trim();
    const prompt = aiPromptInput.value.trim();
    if (!apiKey) {
      alert('請輸入 API Key！');
      return;
    }
    await chrome.storage.local.set({
      ai_model: model,
      ai_api_key: apiKey,
      ai_prompt: prompt
    });
    statusBannerText.textContent = '✅ AI 設定已儲存';
  });

  // 讀取 AI 設定
  const aiSettings = await chrome.storage.local.get(['ai_model', 'ai_api_key', 'ai_prompt']);
  if (aiSettings.ai_model) aiModelSelect.value = aiSettings.ai_model;
  if (aiSettings.ai_api_key) aiApiKeyInput.value = aiSettings.ai_api_key;
  if (aiSettings.ai_prompt) aiPromptInput.value = aiSettings.ai_prompt;

  // 偵測 + 解碼驗證碼
  btnDetectSolveCaptcha.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) {
      alert('未找到可操作的網頁分頁！');
      return;
    }

    const apiKey = aiApiKeyInput.value.trim();
    const model  = aiModelSelect.value;
    if (!apiKey) {
      alert('請先在「⚙️ AI 設定」填入 API Key！');
      return;
    }

    btnDetectSolveCaptcha.disabled = true;
    btnDetectSolveCaptcha.textContent = '⏳ 偵測中...';

    try {
      // 1. 偵測驗證碼是否存在
      const detectRes = await new Promise((resolve) => {
        chrome.tabs.sendMessage(currentTab.id, { action: 'DETECT_CAPTCHA' }, resolve);
      });

      if (!detectRes || !detectRes.detected) {
        captchaResultBox.style.display = 'flex';
        captchaTypeText.textContent = '未偵測到驗證碼';
        captchaAnswerText.textContent = '—';
        btnDetectSolveCaptcha.textContent = '🔍 偵測並解碼驗證碼';
        btnDetectSolveCaptcha.disabled = false;
        return;
      }
      captchaTypeText.textContent = detectRes.type || '未知';
      captchaResultBox.style.display = 'flex';

      // 2. 截圖
      btnDetectSolveCaptcha.textContent = '📸 截圖中...';
      const screenshotRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'CAPTURE_CAPTCHA_SCREENSHOT',
          payload: { tabId: currentTab.id }
        }, resolve);
      });

      if (!screenshotRes || !screenshotRes.success) {
        captchaAnswerText.textContent = `截圖失敗: ${screenshotRes?.error || '未知錯誤'}`;
        return;
      }

      // 3. 取出 base64（去除 data:image/png;base64, 前綴）
      const base64 = screenshotRes.dataUrl.split(',')[1];
      const prompt = aiPromptInput.value.trim();

      // 4. 送至 AI 解析
      btnDetectSolveCaptcha.textContent = '🤖 AI 解析中...';
      const solveRes = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'SOLVE_CAPTCHA_AI',
          payload: { model, apiKey, imageBase64: base64, prompt }
        }, resolve);
      });

      if (!solveRes || !solveRes.success) {
        captchaAnswerText.textContent = `解析失敗: ${solveRes?.error || '未知錯誤'}`;
        return;
      }

      lastCaptchaAnswer = solveRes.answer;
      captchaAnswerText.textContent = lastCaptchaAnswer || '(空回應)';
      statusBannerText.textContent = `🤖 AI 解碼完成：${lastCaptchaAnswer}`;

    } finally {
      btnDetectSolveCaptcha.textContent = '🔍 偵測並解碼驗證碼';
      btnDetectSolveCaptcha.disabled = false;
    }
  });

  // 填入驗證碼答案
  btnFillCaptchaAnswer.addEventListener('click', () => {
    if (!currentTab || !currentTab.id || !lastCaptchaAnswer) return;
    chrome.tabs.sendMessage(currentTab.id, {
      action: 'CAPTCHA_FILL_ANSWER',
      payload: { answer: lastCaptchaAnswer }
    }, (res) => {
      if (res && res.success) {
        statusBannerText.textContent = `✅ 已填入驗證碼：${lastCaptchaAnswer}`;
      } else {
        statusBannerText.textContent = '⚠️ 找不到驗證碼輸入框，請手動填入';
      }
    });
  });

  // ────────────────────────────────────────────────
  // 輔助函式：Config 收集、儲存、讀取
  // ────────────────────────────────────────────────
  function collectCurrentConfig() {
    const pad = (v, len = 2) => String(v || 0).padStart(len, '0');
    const activeTab = document.querySelector('.ftab.active')?.dataset.tab || 'css';
    return {
      date: targetDateInput.value,
      hour: pad(targetHourInput.value),
      minute: pad(targetMinuteInput.value),
      second: pad(targetSecondInput.value),
      ms: pad(targetMsInput.value, 3),
      timezone: selectedTimezone,
      activeTab,
      selector: targetSelectorInput?.value.trim() || '',
      xpath: targetXpathInput?.value.trim() || '',
      searchText: targetSearchText?.value.trim() || '',
      useCoords: useCoordsToggle?.checked || false,
      coords: {
        x: parseInt(coordXInput?.value, 10) || 0,
        y: parseInt(coordYInput?.value, 10) || 0,
        screenX: targetElementInfo?.coords?.screenX,
        screenY: targetElementInfo?.coords?.screenY,
        physicalX: targetElementInfo?.coords?.physicalX,
        physicalY: targetElementInfo?.coords?.physicalY,
        viewportX: targetElementInfo?.coords?.viewportX,
        viewportY: targetElementInfo?.coords?.viewportY,
        isPageCoords: coordsArePageSpace
      },
      useShadowDom: useShadowDomToggle?.checked || false,
      useIframeSearch: useIframeSearchToggle?.checked || false,
      useCoordFallback: useCoordFallbackToggle?.checked !== false,
      repeat: parseInt(repeatCountInput.value, 10) || 1,
      interval: parseInt(repeatIntervalInput.value, 10) || 50,
      useCdp: useCdpToggle?.checked || false,
      useSystemMouse: useSystemMouseToggle?.checked || false,
      pollDuration: parseInt(pollDurationInput?.value, 10) || (currentDomain && currentDomain.includes('ticketplus.com.tw') ? 3000 : 2000),
      targetPreview: targetPreviewText.textContent
    };
  }

  async function saveCurrentConfig() {
    if (!currentDomain) return;
    const cfg = collectCurrentConfig();
    try {
      await chrome.storage.local.set({ [`site_${currentDomain}`]: cfg });
    } catch (e) {
      console.warn('[Popup] Storage save failed:', e);
    }
  }

  async function saveMultiTargets() {
    try {
      await chrome.storage.local.set({ multi_targets: multiTargets });
    } catch (e) {
      console.warn('[Popup] Multi-targets save failed:', e);
    }
  }

  async function loadConfigForDomain(domain) {
    try {
      const res = await chrome.storage.local.get([`site_${domain}`, 'multi_targets']);
      const cfg = res[`site_${domain}`];
      const isTpDomain = domain.includes('ticketplus.com.tw');

      if (isTpDomain) {
        if (targetSelectorInput && !targetSelectorInput.value) {
          targetSelectorInput.placeholder = 'button.v-btn 或輸入「立即購票」';
        }
        if (targetSearchText && !targetSearchText.value) {
          targetSearchText.value = '立即購票';
        }
      }

      if (cfg) {
        if (cfg.timezone) { selectedTimezone = cfg.timezone; tzSelect.value = cfg.timezone; }
        if (cfg.activeTab) {
          document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.ftab-panel').forEach(p => p.classList.remove('active'));
          const activeTabEl = document.querySelector(`.ftab[data-tab="${cfg.activeTab}"]`);
          if (activeTabEl) {
            activeTabEl.classList.add('active');
            document.getElementById(`fpanel-${cfg.activeTab}`)?.classList.add('active');
          }
        }
        if (cfg.selector && targetSelectorInput) targetSelectorInput.value = cfg.selector;
        if (cfg.xpath && targetXpathInput) targetXpathInput.value = cfg.xpath;
        if (cfg.searchText && targetSearchText) targetSearchText.value = cfg.searchText;
        if (cfg.targetPreview) targetPreviewText.textContent = cfg.targetPreview;
        if (cfg.useCoords !== undefined && useCoordsToggle) useCoordsToggle.checked = cfg.useCoords;
        if (cfg.coords) {
          if (coordXInput) coordXInput.value = cfg.coords.x || '';
          if (coordYInput) coordYInput.value = cfg.coords.y || '';
          coordsArePageSpace = cfg.coords.isPageCoords === true;
        }
        if (useShadowDomToggle && cfg.useShadowDom !== undefined) useShadowDomToggle.checked = cfg.useShadowDom;
        if (useIframeSearchToggle && cfg.useIframeSearch !== undefined) useIframeSearchToggle.checked = cfg.useIframeSearch;
        if (useCoordFallbackToggle && cfg.useCoordFallback !== undefined) useCoordFallbackToggle.checked = cfg.useCoordFallback;
        if (cfg.repeat) repeatCountInput.value = cfg.repeat;
        if (cfg.interval) repeatIntervalInput.value = cfg.interval;
        if (useCdpToggle) {
          useCdpToggle.checked = cfg.useCdp !== undefined ? cfg.useCdp : isTpDomain;
        }
        if (useSystemMouseToggle && cfg.useSystemMouse !== undefined) useSystemMouseToggle.checked = cfg.useSystemMouse;
        if (pollDurationInput && cfg.pollDuration !== undefined) pollDurationInput.value = cfg.pollDuration;
      } else if (isTpDomain) {
        if (useCdpToggle) useCdpToggle.checked = true;
      }

      // 恢復多目標清單
      if (Array.isArray(res.multi_targets) && res.multi_targets.length > 0) {
        multiTargets = res.multi_targets;
        renderMultiTargetList();
      }
    } catch (e) {
      console.warn('[Popup] Storage load failed:', e);
    }
  }

  // ────────────────────────────────────────────────
  // 小工具
  // ────────────────────────────────────────────────
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
  }
});
