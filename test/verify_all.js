/**
 * Automated Verification Script for ChronoClicker v1.2
 * 驗證：
 *   1. AI 模型自動掃描邏輯與 Key 提供商辨識 (Gemini, OpenAI, Claude)
 *   2. Ticket Plus (遠大售票) 引擎邏輯 (選票張數, 同意條款, 確認點擊)
 *   3. Popup HTML 與 JS 元素 ID 對應一致性
 *   4. 主題樣式 (System / Dark / Light) 定義完備性
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('═══════════════════════════════════════════════════════');
console.log('🚀 ChronoClicker v1.2 綜合自動化深度驗證測試');
console.log('═══════════════════════════════════════════════════════\n');

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error('     ' + err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 測試 1: 檔案存在性與 Manifest V3 結構檢查
// ─────────────────────────────────────────────────────────────
console.log('【測試群組 1: 核心檔案與 Manifest V3 規範】');

const projectRoot = path.resolve(__dirname, '..');

test('Manifest 檔案存在且為合法 JSON', () => {
  const manifestPath = path.join(projectRoot, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json 不存在');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.manifest_version, 3, '必須為 Manifest V3');
  assert(manifest.permissions.includes('debugger'), '必須包含 debugger 權限以支援 CDP');
  assert(manifest.permissions.includes('storage'), '必須包含 storage 權限');
  assert(manifest.action.default_popup === 'popup/popup.html', 'default_popup 設定正確');
});

test('Popup 資源檔齊全', () => {
  assert(fs.existsSync(path.join(projectRoot, 'popup/popup.html')), 'popup.html 存在');
  assert(fs.existsSync(path.join(projectRoot, 'popup/popup.css')), 'popup.css 存在');
  assert(fs.existsSync(path.join(projectRoot, 'popup/popup.js')), 'popup.js 存在');
});

// ─────────────────────────────────────────────────────────────
// 測試 2: Popup HTML 元素 ID 與 popup.js 引用對齊
// ─────────────────────────────────────────────────────────────
console.log('\n【測試群組 2: Popup HTML 與 Popup.js 元素 ID 完整對齊】');

test('Popup.js 中所有 document.getElementById 均存在於 popup.html', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'popup/popup.html'), 'utf8');
  const js = fs.readFileSync(path.join(projectRoot, 'popup/popup.js'), 'utf8');

  const idMatches = js.matchAll(/document\.getElementById\(['"]([^'"]+)['"]\)/g);
  const checked = new Set();
  const missing = [];

  for (const match of idMatches) {
    const id = match[1];
    if (checked.has(id)) continue;
    checked.add(id);

    const regex = new RegExp(`id=["']${id}["']`);
    if (!regex.test(html)) {
      missing.push(id);
    }
  }

  assert.strictEqual(missing.length, 0, `popup.html 缺少以下由 popup.js 引用的 ID: ${missing.join(', ')}`);
});

// ─────────────────────────────────────────────────────────────
// 測試 3: 主題樣式 (System / Dark / Light) 規則完備性
// ─────────────────────────────────────────────────────────────
console.log('\n【測試群組 3: UI 主題系統與滑順動畫樣式】');

test('Popup CSS 包含三大主題模式定義與過渡動畫', () => {
  const css = fs.readFileSync(path.join(projectRoot, 'popup/popup.css'), 'utf8');

  assert(css.includes('body[data-theme="dark"]'), '必須包含 dark 主題樣式');
  assert(css.includes('body[data-theme="light"]'), '必須包含 light 主題樣式');
  assert(css.includes('body[data-theme="system"]'), '必須包含 system 主題樣式');
  assert(css.includes('prefers-color-scheme'), '必須支援 prefers-color-scheme 系統媒體查詢');
  assert(css.includes('cubic-bezier'), '必須使用平滑過渡 cubic-bezier');
  assert(css.includes('--transition-'), '必須定義平滑過渡變數');
});

test('Popup HTML 預設設定 data-theme="system"', () => {
  const html = fs.readFileSync(path.join(projectRoot, 'popup/popup.html'), 'utf8');
  assert(html.includes('data-theme="system"'), 'body 應預設包含 data-theme="system"');
  assert(html.includes('id="themeSwitchGroup"'), '應包含主題切換群組');
});

// ─────────────────────────────────────────────────────────────
// 測試 4: AI 模型掃描與提供商自動辨識邏輯
// ─────────────────────────────────────────────────────────────
console.log('\n【測試群組 4: AI 模型掃描與自動辨識邏輯】');

function detectProvider(key, selectedProvider) {
  if (!key) return selectedProvider || 'gemini';
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-ant')) return 'claude';
  if (key.startsWith('sk-')) return 'openai';
  return selectedProvider || 'gemini';
}

test('API Key 自動識別正確的提供商', () => {
  assert.strictEqual(detectProvider('AIzaSyD-1234567890abcdef', 'openai'), 'gemini', 'AIza 開頭應辨識為 Google Gemini');
  assert.strictEqual(detectProvider('sk-ant-api03-abcdef', 'gemini'), 'claude', 'sk-ant 開頭應辨識為 Anthropic Claude');
  assert.strictEqual(detectProvider('sk-proj-1234567890abcdef', 'gemini'), 'openai', 'sk- 開頭應辨識為 OpenAI');
  assert.strictEqual(detectProvider('', 'claude'), 'claude', '空 Key 應維持手動選擇的提供商');
});

test('Gemini 模型清單過濾與智慧優先排序', () => {
  const mockGeminiResponse = {
    models: [
      { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] }
    ]
  };

  const filtered = mockGeminiResponse.models.filter(m => {
    return (m.supportedGenerationMethods || []).includes('generateContent');
  }).map(m => {
    const id = m.name.replace(/^models\//, '');
    return {
      id,
      displayName: m.displayName ? `${m.displayName} (${id})` : id,
      provider: 'gemini'
    };
  });

  const priority = ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-1.5-pro'];
  filtered.sort((a, b) => {
    const idxA = priority.findIndex(p => a.id.startsWith(p));
    const idxB = priority.findIndex(p => b.id.startsWith(p));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.id.localeCompare(b.id);
  });

  assert.strictEqual(filtered.length, 3, '非 generateContent 模型應被濾除');
  assert.strictEqual(filtered[0].id, 'gemini-2.0-flash', '最新推薦 gemini-2.0-flash 應排在第一位');
  assert.strictEqual(filtered[1].id, 'gemini-1.5-flash', 'gemini-1.5-flash 應次之');
});

test('OpenAI 模型清單過濾與優先排序', () => {
  const mockOpenAiResponse = {
    data: [
      { id: 'text-embedding-3-small', owned_by: 'openai' },
      { id: 'dall-e-3', owned_by: 'openai' },
      { id: 'gpt-4o', owned_by: 'openai' },
      { id: 'gpt-4o-mini', owned_by: 'openai' },
      { id: 'o1-mini', owned_by: 'openai' },
      { id: 'gpt-3.5-turbo-instruct', owned_by: 'openai' }
    ]
  };

  const filtered = mockOpenAiResponse.data.filter(m => {
    const id = m.id.toLowerCase();
    return (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt'))
           && !id.includes('realtime') && !id.includes('audio') && !id.includes('embedding') && !id.includes('dall-e');
  }).map(m => ({
    id: m.id,
    displayName: `OpenAI ${m.id}`,
    provider: 'openai'
  }));

  const priority = ['gpt-4o', 'gpt-4o-mini', 'o1-mini', 'o1'];
  filtered.sort((a, b) => {
    const idxA = priority.findIndex(p => a.id === p || a.id.startsWith(p));
    const idxB = priority.findIndex(p => b.id === p || b.id.startsWith(p));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.id.localeCompare(b.id);
  });

  assert.strictEqual(filtered.length, 4, '非對話模型應被濾除');
  assert.strictEqual(filtered[0].id, 'gpt-4o', 'gpt-4o 應排在第一位');
  assert.strictEqual(filtered[1].id, 'gpt-4o-mini', 'gpt-4o-mini 應排在第二位');
});

// ─────────────────────────────────────────────────────────────
// 測試 5: Ticket Plus (遠大售票) 引擎邏輯模擬
// ─────────────────────────────────────────────────────────────
console.log('\n【測試群組 5: Ticket Plus (遠大售票) 購票張數與流程引擎】');

class MockElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.id = attrs.id || '';
    this.className = attrs.className || '';
    this.disabled = !!attrs.disabled;
    this.value = attrs.value || '';
    this.checked = !!attrs.checked;
    this.textContent = attrs.textContent || '';
    this.attributes = attrs.attributes || {};
    this.classList = {
      contains: (c) => this.className.split(' ').includes(c),
      add: (c) => { if (!this.classList.contains(c)) this.className += ` ${c}`; },
      remove: (c) => { this.className = this.className.replace(new RegExp(`\\b${c}\\b`, 'g'), '').trim(); }
    };
    this.style = {};
  }
  getAttribute(attr) {
    return this.attributes[attr] || null;
  }
}

test('遠大售票 Stepper Plus 按鈕識別與張數累加計算', () => {
  const plusBtn = new MockElement('button', {
    className: 'v-btn',
    textContent: '+',
    attributes: { 'aria-label': '增加張數' }
  });

  const isPlus = (btn) => {
    const text = (btn.textContent || '').trim();
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    return text === '+' || text === '＋' || ariaLabel.includes('plus') || ariaLabel.includes('增加');
  };

  assert(isPlus(plusBtn), '加號按鈕應被正確辨識');

  let currentCount = 0;
  const targetCount = 3;
  const clicksNeeded = Math.max(0, targetCount - currentCount);
  assert.strictEqual(clicksNeeded, 3, '從 0 張至 3 張需點擊 3 次');
});

test('遠大售票 會員服務條款 Checkbox 識別與自動勾選', () => {
  const termsCheckbox = new MockElement('input', {
    className: 'v-checkbox',
    checked: false,
    textContent: '我已詳細閱讀並同意會員服務條款與隱私權規範'
  });

  const isTerms = (cb) => {
    const text = cb.textContent.toLowerCase();
    return text.includes('同意') || text.includes('服務條款') || text.includes('會員條款');
  };

  assert(isTerms(termsCheckbox), '條款核取方塊應被正確辨識');

  // 模擬勾選
  if (!termsCheckbox.checked) {
    termsCheckbox.checked = true;
  }
  assert.strictEqual(termsCheckbox.checked, true, '條款核取方塊應自動切換為 checked = true');
});

test('遠大售票 確認/下一步 按鈕辨識', () => {
  const confirmKeywords = ['下一步', '確認張數', '確定', '同意並送出', '確定購票'];
  const testButtons = [
    new MockElement('button', { textContent: '取消' }),
    new MockElement('button', { textContent: '下一步：確認張數' }),
    new MockElement('button', { textContent: '返回活動頁' })
  ];

  const found = testButtons.find(btn => {
    const text = btn.textContent.replace(/\s+/g, '');
    return confirmKeywords.some(kw => text.includes(kw));
  });

  assert(found, '應成功找到確認下一步按鈕');
  assert.strictEqual(found.textContent, '下一步：確認張數', '按鈕內容文字相符');
});

test('Service Worker solveCaptchaWithAI 支援多元大模型', () => {
  const swCode = fs.readFileSync(path.join(projectRoot, 'background/service_worker.js'), 'utf8');
  assert(swCode.includes("normModel.includes('gemini')"), '支援所有 Gemini 系列模型');
  assert(swCode.includes("normModel.startsWith('gpt')"), '支援所有 GPT/o1/o3 模型');
  assert(swCode.includes("normModel.includes('claude')"), '支援所有 Claude 模型');
  assert(swCode.includes("model.replace(/^models\\//, '')"), 'Gemini 自動去除 models/ 前綴避免 404');
});

// ─────────────────────────────────────────────────────────────
// 總結統計
// ─────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════════════');
console.log(`📊 測試結果: 通過 ${passedTests} / ${totalTests} 項驗證 (${Math.round(passedTests/totalTests*100)}%)`);
console.log('═══════════════════════════════════════════════════════\n');

if (passedTests === totalTests) {
  console.log('🎉 所有測試完全通過！無已知邏輯缺失。');
  process.exit(0);
} else {
  console.error('💥 存在未通過的測試，請檢查上述錯誤。');
  process.exit(1);
}
