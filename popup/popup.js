/**
 * ChronoClicker - Popup Logic
 * 負責世界時區即時渲染、原子鐘校準狀態維護、目標時間解析與頁面交互調度
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素引用
  const tzSelect = document.getElementById('tzSelect');
  const liveClockTime = document.getElementById('liveClockTime');
  const liveClockMs = document.getElementById('liveClockMs');
  const liveClockDate = document.getElementById('liveClockDate');
  const syncStatusBadge = document.getElementById('syncStatusBadge');
  const syncStatusText = document.getElementById('syncStatusText');
  const currentDomainBadge = document.getElementById('currentDomainBadge');

  const targetDateInput = document.getElementById('targetDate');
  const targetHourInput = document.getElementById('targetHour');
  const targetMinuteInput = document.getElementById('targetMinute');
  const targetSecondInput = document.getElementById('targetSecond');
  const targetMsInput = document.getElementById('targetMs');

  const btnPlus10s = document.getElementById('btnPlus10s');
  const btnPlus30s = document.getElementById('btnPlus30s');
  const btnPlus1m = document.getElementById('btnPlus1m');
  const btnNextHour = document.getElementById('btnNextHour');

  const btnStartPicker = document.getElementById('btnStartPicker');
  const btnTestClick = document.getElementById('btnTestClick');
  const targetPreviewText = document.getElementById('targetPreviewText');

  // 目標備案輸入欄位
  const targetSelectorInput = document.getElementById('targetSelectorInput');
  const targetXpathInput = document.getElementById('targetXpathInput');
  const targetSearchText = document.getElementById('targetSearchText');
  const useCoordsToggle = document.getElementById('useCoordsToggle');
  const coordXInput = document.getElementById('coordX');
  const coordYInput = document.getElementById('coordY');
  const btnCaptureCoords = document.getElementById('btnCaptureCoords');

  // 進階備案 toggles
  const useShadowDomToggle = document.getElementById('useShadowDomToggle');
  const useIframeSearchToggle = document.getElementById('useIframeSearchToggle');
  const useCoordFallbackToggle = document.getElementById('useCoordFallbackToggle');

  const repeatCountInput = document.getElementById('repeatCount');
  const repeatIntervalInput = document.getElementById('repeatInterval');
  const useCdpToggle = document.getElementById('useCdpToggle');

  const btnStartCountdown = document.getElementById('btnStartCountdown');
  const btnStopCountdown = document.getElementById('btnStopCountdown');
  const statusBanner = document.getElementById('statusBanner');
  const statusBannerText = document.getElementById('statusBannerText');

  let currentTab = null;
  let currentDomain = '';
  let selectedTimezone = 'Asia/Taipei';
  let targetElementInfo = null;
  let isCapturingCoords = false;  // 座標擷取模式旗標

  // 1. 初始化時區下拉選單
  TimeSync.TIMEZONES.forEach((tz) => {
    const opt = document.createElement('option');
    opt.value = tz.id;
    opt.textContent = tz.name;
    tzSelect.appendChild(opt);
  });

  // 預設時區選擇
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

  // 座標擷取模式：點擊後要求 content script 進入座標擷取模式
  if (btnCaptureCoords) {
    btnCaptureCoords.addEventListener('click', async () => {
      if (!currentTab || !currentTab.id) return;
      statusBannerText.textContent = '📍 請切換至目標網頁，點擊想要的位置以擷取座標...';
      chrome.tabs.sendMessage(currentTab.id, { action: 'ACTIVATE_COORD_CAPTURE' }, () => {
        if (chrome.runtime.lastError) {
          statusBannerText.textContent = '⚠️ 請先重新整理目標網頁';
          return;
        }
        window.close(); // 關閉 popup 讓使用者在頁面上點擊
      });
    });
  }

  // 2. 初始化時間同步與獲取狀態
  await TimeSync.init();
  updateSyncBadge();

  // 若尚未校準過，背景觸發一次同步
  if (!TimeSync.isSynced) {
    triggerTimeSync();
  }

  syncStatusBadge.addEventListener('click', () => {
    triggerTimeSync();
  });

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

  // 3. 獲取當前分頁與網域設定
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

      // 讀取該網域先前保存之設定
      await loadConfigForDomain(currentDomain);

      // 檢查該分頁目前是否有正在進行的倒數任務
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

  // 4. 即時高頻世界時鐘渲染 (微秒級更新)
  function renderClock() {
    const accurateNow = TimeSync.getAccurateNow();
    const formatted = TimeSync.formatInTimezone(accurateNow, selectedTimezone);

    liveClockTime.childNodes[0].nodeValue = formatted.timeString;
    liveClockMs.textContent = `.${formatted.msString}`;
    liveClockDate.textContent = `${formatted.dateString} (${selectedTimezone})`;

    requestAnimationFrame(renderClock);
  }
  requestAnimationFrame(renderClock);

  // 5. 快速時間推算按鈕
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

  // 預設填入預設時間 (若空白則為 +1 分鐘)
  if (!targetHourInput.value) {
    addTimeOffset(60);
  }

  // 6. 視覺選取元素 (Element Picker)
  btnStartPicker.addEventListener('click', async () => {
    if (!currentTab || !currentTab.id) return;

    statusBannerText.textContent = '🎯 請切換至網頁選取元素，點擊選取或按 ESC 取消...';
    chrome.tabs.sendMessage(currentTab.id, { action: 'ACTIVATE_PICKER' }, (res) => {
      if (chrome.runtime.lastError) {
        statusBannerText.textContent = '⚠️ 請重新整理該網頁後再試';
        return;
      }
      // 縮小或提示
      window.close(); // 關閉 popup 讓使用者在網頁上直接選取
    });
  });

  // 監聽選取結果訊息
  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'ELEMENT_PICKED') {
      const p = req.payload;
      targetElementInfo = p;
      targetPreviewText.textContent = `${p.tagName.toUpperCase()}${p.id ? '#' + p.id : ''} "${p.text || ''}"`;
      if (targetSelectorInput) targetSelectorInput.value = p.selector || '';
      if (p.coords) {
        if (coordXInput) coordXInput.value = p.coords.x;
        if (coordYInput) coordYInput.value = p.coords.y;
      }
      saveCurrentConfig();
    }

    // 座標擷取模式回傳結果：自動填入座標面板
    if (req.action === 'COORD_CAPTURED') {
      const { x, y } = req.payload;
      if (coordXInput) coordXInput.value = x;
      if (coordYInput) coordYInput.value = y;
      if (useCoordsToggle) useCoordsToggle.checked = true;

      // 自動切換至螢幕座標 tab
      document.querySelectorAll('.ftab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.ftab-panel').forEach(p => p.classList.remove('active'));
      document.querySelector('.ftab[data-tab="coord"]')?.classList.add('active');
      document.getElementById('fpanel-coord')?.classList.add('active');

      targetPreviewText.textContent = `📍 螢幕座標 (X:${x}, Y:${y})`;
      statusBannerText.textContent = `✅ 已擷取座標 X:${x}, Y:${y}`;
      saveCurrentConfig();
    }
  });

  // 7. 手動調整輸入項時自動儲存設定
  [
    targetDateInput, targetHourInput, targetMinuteInput, targetSecondInput, targetMsInput,
    targetSelectorInput, targetXpathInput, targetSearchText,
    useCoordsToggle, coordXInput, coordYInput,
    useShadowDomToggle, useIframeSearchToggle, useCoordFallbackToggle,
    repeatCountInput, repeatIntervalInput, useCdpToggle
  ].filter(Boolean).forEach(el => {
    el.addEventListener('input', saveCurrentConfig);

    el.addEventListener('change', saveCurrentConfig);
  });

  // 8. 立即測試點擊
  btnTestClick.addEventListener('click', () => {
    if (!currentTab || !currentTab.id) return;

    const config = collectCurrentConfig();
    chrome.tabs.sendMessage(currentTab.id, {
      action: 'TEST_CLICK',
      payload: config
    }, () => {
      if (chrome.runtime.lastError) {
        alert('無法發送測試點擊，請確認該網頁已重新整理且允許擴充功能。');
      } else {
        statusBannerText.textContent = '⚡ 已在當前網頁觸發測試點擊！';
      }
    });
  });

  // 9. 啟動定時倒數
  btnStartCountdown.addEventListener('click', () => {
    if (!currentTab || !currentTab.id) {
      alert('未找到可操作的網頁分頁！');
      return;
    }

    const config = collectCurrentConfig();

    if (!config.selector && (!config.coords || !config.coords.x)) {
      alert('請先點擊「🎯 選擇網頁元素」或手動輸入目標 Selector！');
      return;
    }

    // 計算目標 UTC Epoch
    const targetEpoch = TimeSync.parseTargetToEpoch(
      config.date,
      `${config.hour}:${config.minute}:${config.second}`,
      config.ms,
      selectedTimezone
    );

    const nowEpoch = TimeSync.getAccurateNow();
    const diff = targetEpoch - nowEpoch;

    if (diff <= 0) {
      alert(`設定的目標時間已過去！請設定未來的時間。\n目標: ${new Date(targetEpoch).toISOString()}\n目前: ${new Date(nowEpoch).toISOString()}`);
      return;
    }

    const payload = {
      ...config,
      targetEpoch: targetEpoch,
      offset: TimeSync.offset,
      formattedTarget: `${config.date} ${config.hour}:${config.minute}:${config.second}.${config.ms}`,
      timezoneLabel: tzSelect.options[tzSelect.selectedIndex].text
    };

    chrome.tabs.sendMessage(currentTab.id, {
      action: 'START_COUNTDOWN',
      payload: payload
    }, () => {
      if (chrome.runtime.lastError) {
        alert('啟動失敗：請先重新整理目標網頁以載入點擊腳本！');
      } else {
        statusBanner.className = 'status-banner active';
        statusBannerText.textContent = `🚀 已啟動！剩餘 ${(diff / 1000).toFixed(1)} 秒`;
      }
    });

    saveCurrentConfig();
  });

  // 10. 停止倒數
  btnStopCountdown.addEventListener('click', () => {
    if (!currentTab || !currentTab.id) return;
    chrome.tabs.sendMessage(currentTab.id, { action: 'STOP_COUNTDOWN' }, () => {
      statusBanner.className = 'status-banner';
      statusBannerText.textContent = '⏹ 倒數已終止';
    });
  });

  // 輔助函式：收集當前所有輸入狀態（含備案欄位）
  function collectCurrentConfig() {
    const pad = (v, len = 2) => String(v || 0).padStart(len, '0');

    // 偵測當前啟用的備案 tab
    const activeTab = document.querySelector('.ftab.active')?.dataset.tab || 'css';

    return {
      date: targetDateInput.value,
      hour: pad(targetHourInput.value),
      minute: pad(targetMinuteInput.value),
      second: pad(targetSecondInput.value),
      ms: pad(targetMsInput.value, 3),
      timezone: selectedTimezone,

      // 目標解析策略
      activeTab,
      selector: targetSelectorInput?.value.trim() || '',
      xpath: targetXpathInput?.value.trim() || '',
      searchText: targetSearchText?.value.trim() || '',

      // 座標備案
      useCoords: useCoordsToggle?.checked || false,
      coords: {
        x: parseInt(coordXInput?.value, 10) || 0,
        y: parseInt(coordYInput?.value, 10) || 0
      },

      // 進階備案選項
      useShadowDom: useShadowDomToggle?.checked || false,
      useIframeSearch: useIframeSearchToggle?.checked || false,
      useCoordFallback: useCoordFallbackToggle?.checked !== false, // 預設 true

      // 點擊選項
      repeat: parseInt(repeatCountInput.value, 10) || 1,
      interval: parseInt(repeatIntervalInput.value, 10) || 50,
      useCdp: useCdpToggle?.checked || false,
      targetPreview: targetPreviewText.textContent
    };
  }

  // 儲存設定至 storage (依網域)
  async function saveCurrentConfig() {
    if (!currentDomain) return;
    const cfg = collectCurrentConfig();
    try {
      await chrome.storage.local.set({
        [`site_${currentDomain}`]: cfg
      });
    } catch (e) {
      console.warn('[Popup] Storage save failed:', e);
    }
  }

  // 讀取該網域之設定（含備案欄位還原）
  async function loadConfigForDomain(domain) {
    try {
      const res = await chrome.storage.local.get([`site_${domain}`]);
      const cfg = res[`site_${domain}`];
      if (cfg) {
        if (cfg.timezone) {
          selectedTimezone = cfg.timezone;
          tzSelect.value = cfg.timezone;
        }

        // 備案 tab 還原
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
        }

        if (useShadowDomToggle && cfg.useShadowDom !== undefined) useShadowDomToggle.checked = cfg.useShadowDom;
        if (useIframeSearchToggle && cfg.useIframeSearch !== undefined) useIframeSearchToggle.checked = cfg.useIframeSearch;
        if (useCoordFallbackToggle && cfg.useCoordFallback !== undefined) useCoordFallbackToggle.checked = cfg.useCoordFallback;

        if (cfg.repeat) repeatCountInput.value = cfg.repeat;
        if (cfg.interval) repeatIntervalInput.value = cfg.interval;
        if (useCdpToggle && cfg.useCdp !== undefined) useCdpToggle.checked = cfg.useCdp;
      }
    } catch (e) {
      console.warn('[Popup] Storage load failed:', e);
    }
  }
});
