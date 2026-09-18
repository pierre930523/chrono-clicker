/**
 * ChronoClicker - Modern Popup Controller v1.2
 * 包含：
 *   - 3 模式主題系統 (跟隨系統 / 極致深色 / 優雅淺色)
 *   - AI 模型自動掃描 API Key 與動態模型選單 (Google Gemini / OpenAI / Anthropic Claude)
 *   - 遠大售票 (ticketplus.com.tw) 深度專屬自動化控制 (選票張數 1-4 / 同意條款 / 自動確認)
 *   - 世界時鐘即時渲染與原子鐘 NTP 校準
 *   - 單目標定時點擊 (CSS Selector / XPath / 文字搜尋 / 螢幕座標)
 *   - 多目標序列排程 (可拖曳排序 / 獨立延遲 / 批量觸發)
 *   - 系統級 Windows 實體滑鼠伺服器連線與 CDP 原生可信點擊
 */

document.addEventListener('DOMContentLoaded', async () => {
  // ────────────────────────────────────────────────
  // 1. DOM 元素引用
  // ────────────────────────────────────────────────
  // 主題切換
  const themeBtns             = document.querySelectorAll('.theme-btn');

  // 主分頁
  const mainTabs              = document.querySelectorAll('.main-tab');
  const mainPanels            = document.querySelectorAll('.main-panel');

  // 時鐘與原子鐘狀態
  const tzSelect              = document.getElementById('tzSelect');
  const liveClockTime         = document.getElementById('liveClockTime');
  const liveClockMs           = document.getElementById('liveClockMs');
  const liveClockDate         = document.getElementById('liveClockDate');
  const syncStatusBadge       = document.getElementById('syncStatusBadge');
  const syncStatusText        = document.getElementById('syncStatusText');
  const currentDomainBadge    = document.getElementById('currentDomainBadge');

  // 目標時間
  const targetDateInput       = document.getElementById('targetDate');
  const targetHourInput       = document.getElementById('targetHour');
  const targetMinuteInput     = document.getElementById('targetMinute');
  const targetSecondInput     = document.getElementById('targetSecond');
  const targetMsInput         = document.getElementById('targetMs');

  const btnPlus10s            = document.getElementById('btnPlus10s');
  const btnPlus30s            = document.getElementById('btnPlus30s');
  const btnPlus1m             = document.getElementById('btnPlus1m');
  const btnNextHour           = document.getElementById('btnNextHour');

  // 點擊目標設定
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

  // 遠大售票專用控制
  const tpActiveIndicator     = document.getElementById('tpActiveIndicator');
  const tpEnabledToggle       = document.getElementById('tpEnabledToggle');
  const tpQtyChips            = document.querySelectorAll('.qty-chip');
  const tpQtyInput            = document.getElementById('tpQtyInput');
  const tpAutoAgreeToggle     = document.getElementById('tpAutoAgreeToggle');
  const tpAutoConfirmToggle   = document.getElementById('tpAutoConfirmToggle');
  const btnRunTpAutoFlow      = document.getElementById('btnRunTpAutoFlow');
  const btnGoToMainTab        = document.getElementById('btnGoToMainTab');

  // 多目標序列面板
  const btnAddTarget          = document.getElementById('btnAddTarget');
  const multiTargetList       = document.getElementById('multiTargetList');
  const multiTargetEmpty      = document.getElementById('multiTargetEmpty');
  const btnStartMultiCountdown= document.getElementById('btnStartMultiCountdown');
  const btnStopMultiCountdown = document.getElementById('btnStopMultiCountdown');

  // AI 模型與掃描控制
  const providerChips         = document.querySelectorAll('.provider-chip');
  const aiProviderSelect      = document.getElementById('aiProviderSelect');
  const aiApiKeyInput         = document.getElementById('aiApiKey');
  const btnToggleApiKey       = document.getElementById('btnToggleApiKey');
  const btnScanModels         = document.getElementById('btnScanModels');
  const scanSpinner           = document.getElementById('scanSpinner');
  const scanBtnText           = document.getElementById('scanBtnText');
  const scanStatusBox         = document.getElementById('scanStatusBox');
  const scanStatusBadge       = document.getElementById('scanStatusBadge');
  const modelCountTag         = document.getElementById('modelCountTag');
  const aiModelSelect         = document.getElementById('aiModelSelect');
  const aiPromptInput         = document.getElementById('aiPrompt');
  const btnSaveAiSettings     = document.getElementById('btnSaveAiSettings');
  const btnDetectSolveCaptcha = document.getElementById('btnDetectSolveCaptcha');
  const captchaResultBox      = document.getElementById('captchaResultBox');
  const captchaTypeText       = document.getElementById('captchaTypeText');
  const captchaAnswerText     = document.getElementById('captchaAnswerText');
  const btnFillCaptchaAnswer  = document.getElementById('btnFillCaptchaAnswer');

  // ────────────────────────────────────────────────
  // 2. 內部狀態
  // ────────────────────────────────────────────────
  let currentTab = null;
  let currentDomain = '';
  let selectedTimezone = 'Asia/Taipei';
  let targetElementInfo = null;
  let multiTargets = [];
  let lastCaptchaAnswer = '';
  let coordsArePageSpace = false;
  let scanDebounceTimer = null;

  let tpSettings = {
    enabled: true,
    targetCount: 1,
    autoAgree: true,
    autoConfirm: true
  };

  // ────────────────────────────────────────────────
  // 3. 三大模式主題切換 (System / Dark / Light)
  // ────────────────────────────────────────────────
  async function initTheme() {
    const res = await chrome.storage.local.get(['chrono_theme']);
    const savedTheme = res.chrono_theme || 'system';
    applyTheme(savedTheme, false);

    themeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        applyTheme(theme, true);
      });
    });

    // 監聽作業系統深色/淺色主題變更
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      chrome.storage.local.get(['chrono_theme'], (r) => {
        if (!r.chrono_theme || r.chrono_theme === 'system') {
          applyTheme('system', false);
        }
      });
    });
  }

  function applyTheme(theme, save = true) {
    document.body.setAttribute('data-theme', theme);
    themeBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    if (save) {
      chrome.storage.local.set({ chrono_theme: theme });
    }
  }

  await initTheme();

  // ────────────────────────────────────────────────
  // 4. 主分頁切換
  // ────────────────────────────────────────────────
  mainTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      mainTabs.forEach(t => t.classList.remove('active'));
      mainPanels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panelId = `mainpanel-${tab.dataset.mainTab}`;
      const panel = document.getElementById(panelId);
      if (panel) panel.classList.add('active');
    });
  });

  if (btnGoToMainTab) {
    btnGoToMainTab.addEventListener('click', () => {
      const mainTabBtn = document.querySelector('.main-tab[data-main-tab="main"]');
      if (mainTabBtn) mainTabBtn.click();
    });
  }

  // 備案解析策略 Tab 切換
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

  // ────────────────────────────────────────────────
  // 5. 世界時區與即時時鐘
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

  function renderClock() {
    const accurateNow = TimeSync.getAccurateNow();
    const formatted = TimeSync.formatInTimezone(accurateNow, selectedTimezone);
    if (liveClockTime && liveClockTime.childNodes[0]) {
      liveClockTime.childNodes[0].nodeValue = formatted.timeString;
    }
    if (liveClockMs) liveClockMs.textContent = `.${formatted.msString}`;
    if (liveClockDate) liveClockDate.textContent = `${formatted.dateString} (${selectedTimezone})`;
    requestAnimationFrame(renderClock);
  }
  requestAnimationFrame(renderClock);

  // 快速時間設定
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
    if (targetDateInput) targetDateInput.value = `${year}-${month}-${day}`;
    if (targetHourInput) targetHourInput.value = h;
    if (targetMinuteInput) targetMinuteInput.value = m;
    if (targetSecondInput) targetSecondInput.value = s;
    if (targetMsInput) targetMsInput.value = '000';
    saveCurrentConfig();
  }

  if (btnPlus10s) btnPlus10s.addEventListener('click', () => addTimeOffset(10));
  if (btnPlus30s) btnPlus30s.addEventListener('click', () => addTimeOffset(30));
  if (btnPlus1m) btnPlus1m.addEventListener('click', () => addTimeOffset(60));
  if (btnNextHour) btnNextHour.addEventListener('click', () => addTimeOffset(0, true));

  if (targetHourInput && !targetHourInput.value) addTimeOffset(60);

  // ────────────────────────────────────────────────
  // 6. 原子鐘時間同步
  // ────────────────────────────────────────────────
  await TimeSync.init();
  updateSyncBadge();
  if (!TimeSync.isSynced) triggerTimeSync();

  if (syncStatusBadge) {
    syncStatusBadge.addEventListener('click', () => triggerTimeSync());
  }

  function updateSyncBadge() {
    if (!syncStatusBadge || !syncStatusText) return;
    if (TimeSync.isSynced) {
      syncStatusBadge.className = 'sync-status synced';
      syncStatusText.textContent = `±${TimeSync.offset}ms (延遲: ${TimeSync.rtt}ms)`;
    } else {
      syncStatusBadge.className = 'sync-status';
      syncStatusText.textContent = '本機時鐘 (點擊同步)';
    }
  }

  function triggerTimeSync() {
    if (!syncStatusBadge || !syncStatusText) return;
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

  // ────────────────────────────────────────────────
  // 7. 本機實體滑鼠伺服器檢測
  // ────────────────────────────────────────────────
  async function checkMouseServer() {
    if (!systemMouseStatusBadge) return;
    systemMouseStatusBadge.textContent = '連線檢測中...';
    systemMouseStatusBadge.className = 'badge-tag';
    chrome.runtime.sendMessage({ action: 'CHECK_SYSTEM_MOUSE_STATUS' }, (res) => {
      if (res && res.available) {
        systemMouseStatusBadge.textContent = '🟢 實體滑鼠已連線';
        systemMouseStatusBadge.className = 'badge-tag online';
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
  // 8. 遠大售票 (Ticket Plus) 深度整合邏輯
  // ────────────────────────────────────────────────
  async function initTicketPlus() {
    try {
      const res = await chrome.storage.local.get(['tp_settings']);
      if (res.tp_settings) {
        Object.assign(tpSettings, res.tp_settings);
      }
    } catch (e) {}

    // 初始化 UI 狀態
    if (tpEnabledToggle) tpEnabledToggle.checked = tpSettings.enabled !== false;
    if (tpAutoAgreeToggle) tpAutoAgreeToggle.checked = tpSettings.autoAgree !== false;
    if (tpAutoConfirmToggle) tpAutoConfirmToggle.checked = tpSettings.autoConfirm !== false;
    if (tpQtyInput) tpQtyInput.value = tpSettings.targetCount || 1;

    updateQtyChipsUI(tpSettings.targetCount || 1);

    // 購票張數 Chips 切換
    tpQtyChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const qty = parseInt(chip.dataset.qty, 10) || 1;
        tpSettings.targetCount = qty;
        if (tpQtyInput) tpQtyInput.value = qty;
        updateQtyChipsUI(qty);
        saveTpSettings();
      });
    });

    // 勾選開關
    if (tpEnabledToggle) {
      tpEnabledToggle.addEventListener('change', () => {
        tpSettings.enabled = tpEnabledToggle.checked;
        saveTpSettings();
      });
    }

    if (tpAutoAgreeToggle) {
      tpAutoAgreeToggle.addEventListener('change', () => {
        tpSettings.autoAgree = tpAutoAgreeToggle.checked;
        saveTpSettings();
      });
    }

    if (tpAutoConfirmToggle) {
      tpAutoConfirmToggle.addEventListener('change', () => {
        tpSettings.autoConfirm = tpAutoConfirmToggle.checked;
        saveTpSettings();
      });
    }

    // 立即執行自動流程測試按鈕
    if (btnRunTpAutoFlow) {
      btnRunTpAutoFlow.addEventListener('click', async () => {
        if (!currentTab || !currentTab.id) {
          alert('請先切換至 Ticket Plus 售票分頁！');
          return;
        }
        btnRunTpAutoFlow.disabled = true;
        statusBannerText.textContent = `🎫 正在執行自動選 ${tpSettings.targetCount} 張票與確認流程...`;

        chrome.tabs.sendMessage(currentTab.id, {
          action: 'EXECUTE_TP_AUTO_FLOW',
          payload: { ...tpSettings, forceReset: true }
        }, (res) => {
          btnRunTpAutoFlow.disabled = false;
          if (chrome.runtime.lastError) {
            statusBannerText.textContent = '⚠️ 請先重新整理售票頁面';
            return;
          }
          if (res && res.success) {
            statusBanner.className = 'status-banner active';
            statusBannerText.textContent = `✅ 遠大自動流程完成：已選 ${res.targetCount} 張票 ${res.confirmed ? '，已送出確定' : ''}`;
          } else {
            statusBannerText.textContent = `⚠️ 自動流程回傳：${res?.reason || '未找到目標元素'}`;
          }
        });
      });
    }
  }

  function updateQtyChipsUI(targetQty) {
    tpQtyChips.forEach(chip => {
      const q = parseInt(chip.dataset.qty, 10);
      chip.classList.toggle('active', q === targetQty);
    });
  }

  function saveTpSettings() {
    chrome.storage.local.set({ tp_settings: tpSettings });
    if (currentTab && currentTab.id) {
      chrome.tabs.sendMessage(currentTab.id, {
        action: 'UPDATE_TP_SETTINGS',
        payload: tpSettings
      }, () => {
        if (chrome.runtime.lastError) {} // 忽略未載入錯誤
      });
    }
  }

  await initTicketPlus();

  // ────────────────────────────────────────────────
  // ────────────────────────────────────────────────
  // 9. AI 模型自動掃描與驗證碼設定
  // ────────────────────────────────────────────────
  const DEFAULT_MODELS_BY_PROVIDER = {
    gemini: [
      { id: 'gemini-2.0-flash', displayName: 'Google Gemini 2.0 Flash (推薦)', description: '次世代超極速多模態模型', provider: 'gemini' },
      { id: 'gemini-1.5-flash', displayName: 'Google Gemini 1.5 Flash', description: '輕量極速多模態', provider: 'gemini' },
      { id: 'gemini-1.5-pro', displayName: 'Google Gemini 1.5 Pro', description: '高精度複雜推理', provider: 'gemini' }
    ],
    openai: [
      { id: 'gpt-4o', displayName: 'OpenAI GPT-4o (推薦)', description: '多模態全能旗艦', provider: 'openai' },
      { id: 'gpt-4o-mini', displayName: 'OpenAI GPT-4o Mini', description: '極速經濟型', provider: 'openai' },
      { id: 'o3-mini', displayName: 'OpenAI o3-mini', description: '高深度邏輯推理', provider: 'openai' },
      { id: 'o1-mini', displayName: 'OpenAI o1-mini', description: '數學與程式優化', provider: 'openai' }
    ],
    claude: [
      { id: 'claude-3-7-sonnet-20250219', displayName: 'Claude 3.7 Sonnet (最新旗艦)', description: '最新思考與多模態旗艦', provider: 'claude' },
      { id: 'claude-3-5-sonnet-20241022', displayName: 'Claude 3.5 Sonnet (熱門推薦)', description: '高智慧高速度多模態', provider: 'claude' },
      { id: 'claude-3-5-haiku-20241022', displayName: 'Claude 3.5 Haiku', description: '極速輕量多模態', provider: 'claude' },
      { id: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus', description: '深度推理', provider: 'claude' }
    ]
  };

  let scannedModelsCache = {
    gemini: [],
    openai: [],
    claude: []
  };
  let providerApiKeys = {
    gemini: '',
    openai: '',
    claude: ''
  };

  async function initAiScanner() {
    // 讀取已存設定 (支援個別提供商獨立快取與 API Key)
    const res = await chrome.storage.local.get([
      'ai_provider', 'ai_model', 'ai_api_key', 'ai_api_keys',
      'ai_prompt', 'scanned_models', 'scanned_models_by_provider'
    ]);

    if (res.ai_api_keys) Object.assign(providerApiKeys, res.ai_api_keys);
    if (res.scanned_models_by_provider) Object.assign(scannedModelsCache, res.scanned_models_by_provider);

    const savedProvider = res.ai_provider || 'gemini';
    if (aiProviderSelect) aiProviderSelect.value = savedProvider;
    updateProviderChipsUI(savedProvider);
    updateApiKeyPlaceholder(savedProvider);

    // 優先使用 providerApiKeys，其次平鋪 ai_api_key
    if (!providerApiKeys[savedProvider] && res.ai_api_key) {
      providerApiKeys[savedProvider] = res.ai_api_key;
    }
    if (aiApiKeyInput) {
      aiApiKeyInput.value = providerApiKeys[savedProvider] || '';
    }

    if (res.ai_prompt && aiPromptInput) aiPromptInput.value = res.ai_prompt;

    // 若相容舊版單一 scanned_models，匯入至當前提供商快取
    if (Array.isArray(res.scanned_models) && res.scanned_models.length > 0 && scannedModelsCache[savedProvider].length === 0) {
      scannedModelsCache[savedProvider] = res.scanned_models;
    }

    // 載入當前提供商的模型選單
    loadModelsForProvider(savedProvider, res.ai_model);

    // 模型選取變更時立即自動持久化
    if (aiModelSelect) {
      aiModelSelect.addEventListener('change', () => {
        chrome.storage.local.set({ ai_model: aiModelSelect.value });
        console.log(`[ChronoClicker] 已記住選擇的 AI 模型: ${aiModelSelect.value}`);
      });
    }

    // AI 提供商 Chips 切換
    providerChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const provider = chip.dataset.provider;
        switchProvider(provider);
      });
    });

    // API Key 顯示/隱藏切換
    if (btnToggleApiKey && aiApiKeyInput) {
      btnToggleApiKey.addEventListener('click', () => {
        const isHidden = aiApiKeyInput.type === 'password';
        aiApiKeyInput.type = isHidden ? 'text' : 'password';
        btnToggleApiKey.textContent = isHidden ? '🙈' : '👁';
      });
    }

    // API Key 自動偵測提供商與防抖掃描
    if (aiApiKeyInput) {
      aiApiKeyInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const currentProvider = aiProviderSelect ? aiProviderSelect.value : 'gemini';
        providerApiKeys[currentProvider] = val;

        detectProviderFromKey(val);

        clearTimeout(scanDebounceTimer);
        if (val.length >= 20) {
          scanDebounceTimer = setTimeout(() => {
            triggerScanModels({ silentOnEmpty: true });
          }, 700);
        }
      });
    }

    // 掃描模型按鈕
    if (btnScanModels) {
      btnScanModels.addEventListener('click', () => {
        triggerScanModels({ silentOnEmpty: false });
      });
    }

    // 儲存 AI 設定
    if (btnSaveAiSettings) {
      btnSaveAiSettings.addEventListener('click', async () => {
        const provider = aiProviderSelect ? aiProviderSelect.value : 'gemini';
        const model = aiModelSelect ? aiModelSelect.value : '';
        const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : '';
        const prompt = aiPromptInput ? aiPromptInput.value.trim() : '';

        if (!apiKey) {
          alert('請輸入 API Key！');
          return;
        }

        providerApiKeys[provider] = apiKey;

        await chrome.storage.local.set({
          ai_provider: provider,
          ai_model: model,
          ai_api_key: apiKey,
          ai_api_keys: providerApiKeys,
          ai_prompt: prompt
        });

        statusBannerText.textContent = '✅ AI 設定已成功儲存！';
      });
    }
  }

  function switchProvider(provider) {
    if (aiProviderSelect) aiProviderSelect.value = provider;
    updateProviderChipsUI(provider);
    updateApiKeyPlaceholder(provider);

    // 填入該提供商已存的 Key
    if (aiApiKeyInput) {
      aiApiKeyInput.value = providerApiKeys[provider] || '';
    }

    // 載入該提供商之模型
    loadModelsForProvider(provider);

    // 儲存當前提供商
    chrome.storage.local.set({
      ai_provider: provider,
      ai_api_keys: providerApiKeys
    });
  }

  function loadModelsForProvider(provider, preferredModelId = null) {
    const cached = scannedModelsCache[provider];
    if (Array.isArray(cached) && cached.length > 0) {
      populateModelDropdown(cached, preferredModelId);
      if (modelCountTag) modelCountTag.textContent = `已掃描 ${cached.length} 個可用模型`;
      if (scanStatusBox && scanStatusBadge) {
        scanStatusBox.style.display = 'flex';
        scanStatusBadge.className = 'badge-tag scan-badge';
        scanStatusBadge.textContent = `✨ 已快取 ${cached.length} 個模型 (${provider.toUpperCase()})`;
      }
    } else {
      const defaults = DEFAULT_MODELS_BY_PROVIDER[provider] || [];
      populateModelDropdown(defaults, preferredModelId);
      if (modelCountTag) modelCountTag.textContent = `${defaults.length} 個推薦模型 (點擊掃描更新)`;
      if (scanStatusBox) scanStatusBox.style.display = 'none';
    }
  }

  function updateProviderChipsUI(activeProvider) {
    providerChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.provider === activeProvider);
    });
  }

  function updateApiKeyPlaceholder(provider) {
    if (!aiApiKeyInput) return;
    if (provider === 'gemini') {
      aiApiKeyInput.placeholder = '貼上 Gemini Key (AIzaSy...)';
    } else if (provider === 'openai') {
      aiApiKeyInput.placeholder = '貼上 OpenAI Key (sk-...)';
    } else if (provider === 'claude') {
      aiApiKeyInput.placeholder = '貼上 Anthropic Key (sk-ant-...)';
    }
  }

  function detectProviderFromKey(key) {
    if (!key) return;
    let detected = null;
    if (key.startsWith('AIza')) {
      detected = 'gemini';
    } else if (key.startsWith('sk-ant')) {
      detected = 'claude';
    } else if (key.startsWith('sk-')) {
      detected = 'openai';
    }

    if (detected && aiProviderSelect && aiProviderSelect.value !== detected) {
      switchProvider(detected);
      console.log(`[ChronoClicker] 依 API Key 自動切換至提供商: ${detected}`);
    }
  }

  async function triggerScanModels(options = {}) {
    const key = aiApiKeyInput ? aiApiKeyInput.value.trim() : '';
    const provider = aiProviderSelect ? aiProviderSelect.value : 'gemini';

    if (!key) {
      if (!options.silentOnEmpty) alert('請先貼上 API Key 後再點擊掃描！');
      return;
    }

    // UI 顯示掃描中狀態
    if (scanSpinner) scanSpinner.style.display = 'inline-block';
    if (scanBtnText) scanBtnText.textContent = '掃描中...';
    if (btnScanModels) btnScanModels.disabled = true;

    try {
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'SCAN_AI_MODELS',
          payload: { provider, apiKey: key }
        }, resolve);
      });

      if (res && res.success && Array.isArray(res.models) && res.models.length > 0) {
        populateModelDropdown(res.models);
        if (modelCountTag) modelCountTag.textContent = `共 ${res.models.length} 個可用模型`;

        if (scanStatusBox && scanStatusBadge) {
          scanStatusBox.style.display = 'flex';
          scanStatusBadge.className = 'badge-tag scan-badge';
          scanStatusBadge.textContent = `✨ 成功掃描到 ${res.models.length} 個模型 (${res.provider.toUpperCase()})`;
        }

        // 更新本機與快取
        scannedModelsCache[res.provider] = res.models;
        providerApiKeys[res.provider] = key;

        chrome.storage.local.set({
          scanned_models: res.models,
          scanned_models_by_provider: scannedModelsCache,
          ai_provider: res.provider,
          ai_model: aiModelSelect ? aiModelSelect.value : '',
          ai_api_key: key,
          ai_api_keys: providerApiKeys
        });

        statusBannerText.textContent = `🤖 成功掃描到 ${res.models.length} 個最新 AI 模型！`;
      } else {
        const err = res?.error || '無法取得模型清單';
        if (scanStatusBox && scanStatusBadge) {
          scanStatusBox.style.display = 'flex';
          scanStatusBadge.className = 'badge-tag offline';
          scanStatusBadge.textContent = `⚠️ 掃描失敗: ${err}`;
        }
        if (!options.silentOnEmpty) {
          alert(`掃描失敗: ${err}\n請確認 API Key 是否正確且具備存取權限。`);
        }
      }
    } catch (err) {
      console.warn('[Popup] Scan models error:', err);
    } finally {
      if (scanSpinner) scanSpinner.style.display = 'none';
      if (scanBtnText) scanBtnText.textContent = '🔍 掃描模型';
      if (btnScanModels) btnScanModels.disabled = false;
    }
  }

  function populateModelDropdown(models, preferredModelId = null) {
    if (!aiModelSelect) return;
    const currentVal = preferredModelId || aiModelSelect.value;
    aiModelSelect.innerHTML = '';

    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.displayName || m.id;
      if (m.description) opt.title = m.description;
      aiModelSelect.appendChild(opt);
    });

    // 嘗試恢復原有選取，否則預設選取第一個
    const match = Array.from(aiModelSelect.options).find(o => o.value === currentVal);
    if (match) {
      aiModelSelect.value = currentVal;
    } else if (aiModelSelect.options.length > 0) {
      aiModelSelect.selectedIndex = 0;
    }

    // 儲存選取的模型
    if (aiModelSelect.value) {
      chrome.storage.local.set({ ai_model: aiModelSelect.value });
    }
  }

  await initAiScanner();

  // ────────────────────────────────────────────────
  // 10. AI 驗證碼偵測與解碼
  // ────────────────────────────────────────────────
  if (btnDetectSolveCaptcha) {
    btnDetectSolveCaptcha.addEventListener('click', async () => {
      if (!currentTab || !currentTab.id) {
        alert('未找到可操作的網頁分頁！');
        return;
      }

      const apiKey = aiApiKeyInput ? aiApiKeyInput.value.trim() : '';
      const model  = aiModelSelect ? aiModelSelect.value : 'gemini-2.0-flash';
      if (!apiKey) {
        alert('請先在「🤖 AI 設定」填入 API Key！');
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
          if (captchaResultBox) captchaResultBox.style.display = 'block';
          if (captchaTypeText) captchaTypeText.textContent = '未偵測到驗證碼';
          if (captchaAnswerText) captchaAnswerText.textContent = '—';
          btnDetectSolveCaptcha.textContent = '🔍 偵測並解碼驗證碼';
          btnDetectSolveCaptcha.disabled = false;
          return;
        }

        if (captchaTypeText) captchaTypeText.textContent = detectRes.type || '未知';
        if (captchaResultBox) captchaResultBox.style.display = 'block';

        // 2. 截圖
        btnDetectSolveCaptcha.textContent = '📸 截圖中...';
        const screenshotRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'CAPTURE_CAPTCHA_SCREENSHOT',
            payload: { tabId: currentTab.id }
          }, resolve);
        });

        if (!screenshotRes || !screenshotRes.success) {
          if (captchaAnswerText) captchaAnswerText.textContent = `截圖失敗: ${screenshotRes?.error || '未知錯誤'}`;
          return;
        }

        const base64 = screenshotRes.dataUrl.split(',')[1];
        const prompt = aiPromptInput ? aiPromptInput.value.trim() : '';

        // 3. 送至 AI 解析
        btnDetectSolveCaptcha.textContent = '🤖 AI 解析中...';
        const solveRes = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'SOLVE_CAPTCHA_AI',
            payload: { model, apiKey, imageBase64: base64, prompt }
          }, resolve);
        });

        if (!solveRes || !solveRes.success) {
          if (captchaAnswerText) captchaAnswerText.textContent = `解析失敗: ${solveRes?.error || '未知錯誤'}`;
          return;
        }

        lastCaptchaAnswer = solveRes.answer;
        if (captchaAnswerText) captchaAnswerText.textContent = lastCaptchaAnswer || '(空回應)';
        if (statusBannerText) statusBannerText.textContent = `🤖 AI 解碼完成：${lastCaptchaAnswer}`;

      } finally {
        btnDetectSolveCaptcha.textContent = '🔍 偵測並解碼驗證碼';
        btnDetectSolveCaptcha.disabled = false;
      }
    });
  }

  // 填入驗證碼答案按鈕
  if (btnFillCaptchaAnswer) {
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
  }

  // ────────────────────────────────────────────────
  // 11. 當前分頁與網頁配置載入
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
      if (currentDomainBadge) currentDomainBadge.textContent = currentDomain;

      const isTp = currentDomain.includes('ticketplus.com.tw');
      if (isTp) {
        if (tpBadge) tpBadge.style.display = 'inline-block';
        if (useCdpToggle) useCdpToggle.checked = true;
        if (tpActiveIndicator) {
          tpActiveIndicator.classList.add('active');
          tpActiveIndicator.textContent = '🟢 已連線 Ticket Plus';
        }
      } else {
        if (tpActiveIndicator) {
          tpActiveIndicator.classList.remove('active');
          tpActiveIndicator.textContent = '⚪ 未偵測到售票頁面';
        }
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
  // 12. 元素選取器與座標擷取
  // ────────────────────────────────────────────────
  if (btnStartPicker) {
    btnStartPicker.addEventListener('click', async () => {
      if (!currentTab || !currentTab.id) return;
      statusBannerText.textContent = '🎯 請切換至網頁選取元素，點擊選取或按 ESC 取消...';
      chrome.tabs.sendMessage(currentTab.id, { action: 'ACTIVATE_PICKER' }, () => {
        if (chrome.runtime.lastError) {
          statusBannerText.textContent = '⚠️ 請重新整理該網頁後再試';
          return;
        }
        window.close();
      });
    });
  }

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

  // 監聽選取結果訊息
  chrome.runtime.onMessage.addListener((req) => {
    if (req.action === 'ELEMENT_PICKED') {
      const p = req.payload;
      targetElementInfo = p;
      if (targetPreviewText) {
        targetPreviewText.textContent = `${p.tagName.toUpperCase()}${p.id ? '#' + p.id : ''} "${p.text || ''}"`;
      }
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

      if (targetPreviewText) targetPreviewText.textContent = `📍 頁面座標 (X:${x}, Y:${y})`;
      statusBannerText.textContent = `✅ 已擷取座標 X:${x}, Y:${y}`;
      saveCurrentConfig();
    }
  });

  // ────────────────────────────────────────────────
  // 13. 設定自動儲存
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
  // 14. 立即測試點擊
  // ────────────────────────────────────────────────
  if (btnTestClick) {
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
  }

  // ────────────────────────────────────────────────
  // 15. 單目標定時倒數
  // ────────────────────────────────────────────────
  if (btnStartCountdown) {
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
        timezoneLabel: tzSelect.options[tzSelect.selectedIndex]?.text || selectedTimezone
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
  }

  if (btnStopCountdown) {
    btnStopCountdown.addEventListener('click', () => {
      if (!currentTab || !currentTab.id) return;
      chrome.runtime.sendMessage({ action: 'DETACH_CDP', payload: { tabId: currentTab.id } });
      chrome.tabs.sendMessage(currentTab.id, { action: 'STOP_COUNTDOWN' }, () => {
        statusBanner.className = 'status-banner';
        statusBannerText.textContent = '⏹ 倒數已終止';
      });
    });
  }

  // ────────────────────────────────────────────────
  // 16. 多目標序列點擊
  // ────────────────────────────────────────────────
  if (btnAddTarget) {
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
  }

  function renderMultiTargetList() {
    if (!multiTargetList) return;
    multiTargetList.innerHTML = '';
    if (multiTargets.length === 0) {
      if (multiTargetEmpty) multiTargetEmpty.style.display = 'block';
      return;
    }
    if (multiTargetEmpty) multiTargetEmpty.style.display = 'none';

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
          <button type="button" class="btn-remove-target" data-id="${t.id}" title="移除此目標">✕</button>
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

      // 移除
      item.querySelector('.btn-remove-target').addEventListener('click', (e) => {
        const removeId = parseInt(e.currentTarget.dataset.id, 10);
        multiTargets = multiTargets.filter(x => x.id !== removeId);
        renderMultiTargetList();
        saveMultiTargets();
      });

      // 輸入更新
      item.querySelector('.ti-selector').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        const tid = parseInt(e.target.dataset.id, 10);
        const tgt = multiTargets.find(x => x.id === tid);
        if (!tgt) return;
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
        const tid = parseInt(e.target.dataset.id, 10);
        const tgt = multiTargets.find(x => x.id === tid);
        if (tgt) { tgt.label = e.target.value; saveMultiTargets(); }
      });

      item.querySelector('.ti-delay').addEventListener('input', (e) => {
        const tid = parseInt(e.target.dataset.id, 10);
        const tgt = multiTargets.find(x => x.id === tid);
        if (tgt) { tgt.delayMs = parseInt(e.target.value, 10) || 0; saveMultiTargets(); }
      });

      item.querySelector('.ti-repeat').addEventListener('input', (e) => {
        const tid = parseInt(e.target.dataset.id, 10);
        const tgt = multiTargets.find(x => x.id === tid);
        if (tgt) { tgt.repeat = parseInt(e.target.value, 10) || 1; saveMultiTargets(); }
      });

      // 拖曳排序
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
        const fromId = parseInt(e.dataTransfer.getData('text/plain'), 10);
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

  if (btnStartMultiCountdown) {
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
  }

  if (btnStopMultiCountdown) {
    btnStopMultiCountdown.addEventListener('click', () => {
      if (!currentTab || !currentTab.id) return;
      chrome.runtime.sendMessage({ action: 'DETACH_CDP', payload: { tabId: currentTab.id } });
      chrome.tabs.sendMessage(currentTab.id, { action: 'STOP_COUNTDOWN' }, () => {
        statusBanner.className = 'status-banner';
        statusBannerText.textContent = '⏹ 多目標倒數已終止';
      });
    });
  }

  // ────────────────────────────────────────────────
  // 17. 輔助函式：收集、儲存、讀取配置
  // ────────────────────────────────────────────────
  function collectCurrentConfig() {
    const pad = (v, len = 2) => String(v || 0).padStart(len, '0');
    const activeTab = document.querySelector('.ftab.active')?.dataset.tab || 'css';
    return {
      date: targetDateInput?.value || '',
      hour: pad(targetHourInput?.value),
      minute: pad(targetMinuteInput?.value),
      second: pad(targetSecondInput?.value),
      ms: pad(targetMsInput?.value, 3),
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
      repeat: parseInt(repeatCountInput?.value, 10) || 1,
      interval: parseInt(repeatIntervalInput?.value, 10) || 50,
      useCdp: useCdpToggle?.checked || false,
      useSystemMouse: useSystemMouseToggle?.checked || false,
      pollDuration: parseInt(pollDurationInput?.value, 10) || (currentDomain && currentDomain.includes('ticketplus.com.tw') ? 3000 : 2000),
      targetPreview: targetPreviewText?.textContent || ''
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
        if (cfg.targetPreview && targetPreviewText) targetPreviewText.textContent = cfg.targetPreview;
        if (cfg.useCoords !== undefined && useCoordsToggle) useCoordsToggle.checked = cfg.useCoords;
        if (cfg.coords) {
          if (coordXInput) coordXInput.value = cfg.coords.x || '';
          if (coordYInput) coordYInput.value = cfg.coords.y || '';
          coordsArePageSpace = cfg.coords.isPageCoords === true;
        }
        if (useShadowDomToggle && cfg.useShadowDom !== undefined) useShadowDomToggle.checked = cfg.useShadowDom;
        if (useIframeSearchToggle && cfg.useIframeSearch !== undefined) useIframeSearchToggle.checked = cfg.useIframeSearch;
        if (useCoordFallbackToggle && cfg.useCoordFallback !== undefined) useCoordFallbackToggle.checked = cfg.useCoordFallback;
        if (cfg.repeat && repeatCountInput) repeatCountInput.value = cfg.repeat;
        if (cfg.interval && repeatIntervalInput) repeatIntervalInput.value = cfg.interval;
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
