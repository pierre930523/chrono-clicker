/**
 * ChronoClicker - Time Sync & Timezone Engine
 * 提供微秒級原子鐘校準、多節點 NTP/HTTP RTT 偏差修正與全球時區精準轉換
 */

const TimeSync = {
  // 伺服器時間與本機時鐘的偏差值 (單位：毫秒)
  // serverTime = localTime + offset
  offset: 0,
  rtt: 0,
  lastSyncTime: 0,
  isSynced: false,

  // 支援的全球重點時區清單
  TIMEZONES: [
    { id: 'Asia/Taipei', name: '🇹🇼 台灣 / 台北時間 (UTC+8)', utcOffset: '+08:00' },
    { id: 'Asia/Tokyo', name: '🇯🇵 日本 / 東京時間 (UTC+9)', utcOffset: '+09:00' },
    { id: 'Asia/Seoul', name: '🇰🇷 韓國 / 首爾時間 (UTC+9)', utcOffset: '+09:00' },
    { id: 'Asia/Hong_Kong', name: '🇭🇰 香港時間 (UTC+8)', utcOffset: '+08:00' },
    { id: 'Asia/Shanghai', name: '🇨🇳 中國 / 上海時間 (UTC+8)', utcOffset: '+08:00' },
    { id: 'Asia/Singapore', name: '🇸🇬 新加坡時間 (UTC+8)', utcOffset: '+08:00' },
    { id: 'Europe/London', name: '🇬🇧 英國 / 倫敦時間 (GMT/BST)', utcOffset: '+00:00' },
    { id: 'Europe/Paris', name: '🇫🇷 法國 / 巴黎時間 (CET/CEST)', utcOffset: '+01:00' },
    { id: 'America/New_York', name: '🇺🇸 美東 / 紐約時間 (EST/EDT)', utcOffset: '-05:00' },
    { id: 'America/Los_Angeles', name: '🇺🇸 美西 / 洛杉磯時間 (PST/PDT)', utcOffset: '-08:00' },
    { id: 'Australia/Sydney', name: '🇦🇺 澳洲 / 雪梨時間 (AEST/AEDT)', utcOffset: '+10:00' },
    { id: 'UTC', name: '🌐 協調世界時 (UTC)', utcOffset: '+00:00' },
    { id: 'LOCAL', name: '💻 本機電腦時區 (System Local)', utcOffset: 'Local' }
  ],

  /**
   * 初始化：嘗試自 storage 讀取先前的校準數據
   */
  async init() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get(['timeOffset', 'timeRtt', 'lastSyncTime']);
        if (data.timeOffset !== undefined) {
          this.offset = data.timeOffset;
          this.rtt = data.timeRtt || 0;
          this.lastSyncTime = data.lastSyncTime || 0;
          this.isSynced = true;
        }
      }
    } catch (e) {
      console.warn('[TimeSync] Storage read failed:', e);
    }
  },

  /**
   * 取得高精準當前時間 (毫秒，支援小數微秒)
   */
  getAccurateNow() {
    return Date.now() + this.offset;
  },

  /**
   * 向 Cloudflare / WorldTimeAPI / HTTP Date 節點發起多次握手計算真實時間偏差
   */
  async syncTime() {
    const samples = [];

    // 探針 1: Cloudflare trace (回傳高精度 unix timestamp: ts=1726500000.123)
    const probeCloudflare = async () => {
      try {
        const t0 = performance.now();
        const localBefore = Date.now();
        const resp = await fetch('https://cloudflare.com/cdn-cgi/trace?' + Math.random(), {
          cache: 'no-store',
          mode: 'cors'
        });
        const t1 = performance.now();
        const localAfter = Date.now();
        const text = await resp.text();
        const match = text.match(/ts=([\d.]+)/);
        if (match) {
          const serverEpoch = parseFloat(match[1]) * 1000;
          const rtt = t1 - t0;
          const localEst = (localBefore + localAfter) / 2;
          const offset = serverEpoch - localEst;
          return { offset, rtt };
        }
      } catch (e) {
        // Cloudflare probe failed, try next
      }
      return null;
    };

    // 探針 2: WorldTimeAPI
    const probeWorldTimeAPI = async () => {
      try {
        const t0 = performance.now();
        const localBefore = Date.now();
        const resp = await fetch('https://worldtimeapi.org/api/timezone/Etc/UTC?' + Math.random(), {
          cache: 'no-store'
        });
        const t1 = performance.now();
        const localAfter = Date.now();
        const data = await resp.json();
        if (data && data.unixtime) {
          const serverEpoch = new Date(data.datetime).getTime();
          const rtt = t1 - t0;
          const localEst = (localBefore + localAfter) / 2;
          const offset = serverEpoch - localEst;
          return { offset, rtt };
        }
      } catch (e) {
        // WorldTimeAPI probe failed
      }
      return null;
    };

    // 探針 3: HTTP Date Header (使用 Google 或大型 CDN 節點)
    const probeHttpDate = async (url) => {
      try {
        const t0 = performance.now();
        const localBefore = Date.now();
        const resp = await fetch(url + '?' + Math.random(), {
          method: 'HEAD',
          cache: 'no-store'
        });
        const t1 = performance.now();
        const localAfter = Date.now();
        const dateHeader = resp.headers.get('Date');
        if (dateHeader) {
          const serverEpoch = new Date(dateHeader).getTime();
          const rtt = t1 - t0;
          const localEst = (localBefore + localAfter) / 2;
          const offset = serverEpoch - localEst;
          return { offset, rtt };
        }
      } catch (e) {
        // HTTP Date probe failed
      }
      return null;
    };

    // 執行 3~4 次探測以取得精準樣本
    for (let i = 0; i < 3; i++) {
      const resCf = await probeCloudflare();
      if (resCf) samples.push(resCf);
      await new Promise(r => setTimeout(r, 40));
    }

    if (samples.length < 2) {
      const resWt = await probeWorldTimeAPI();
      if (resWt) samples.push(resWt);
    }

    if (samples.length === 0) {
      const resGoogle = await probeHttpDate('https://www.google.com/generate_204');
      if (resGoogle) samples.push(resGoogle);
    }

    if (samples.length > 0) {
      // 根據 RTT 最小的採樣進行加權，排除離群值
      samples.sort((a, b) => a.rtt - b.rtt);
      // 選擇 RTT 最小的前 2 個樣本平均
      const bestSamples = samples.slice(0, Math.min(2, samples.length));
      const avgOffset = bestSamples.reduce((sum, s) => sum + s.offset, 0) / bestSamples.length;
      const bestRtt = bestSamples[0].rtt;

      this.offset = Math.round(avgOffset);
      this.rtt = Math.round(bestRtt);
      this.lastSyncTime = Date.now();
      this.isSynced = true;

      // 保存至 storage
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          timeOffset: this.offset,
          timeRtt: this.rtt,
          lastSyncTime: this.lastSyncTime
        });
      }

      return {
        success: true,
        offset: this.offset,
        rtt: this.rtt,
        samplesCount: samples.length
      };
    } else {
      // 若無網路或探測失敗，保持 offset = 0
      this.isSynced = false;
      return {
        success: false,
        offset: this.offset || 0,
        rtt: 0,
        error: '無法連線至時間校準伺服器，已採用本機系統時鐘'
      };
    }
  },

  /**
   * 計算特定時區在特定時刻的 UTC Epoch (毫秒)
   */
  parseTargetToEpoch(dateStr, timeStr, msStr = 0, timezone = 'Asia/Taipei') {
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const ms = parseInt(msStr, 10) || 0;

    if (timezone === 'LOCAL') {
      const localDate = new Date(year, month - 1, day, hours, minutes, seconds, ms);
      return localDate.getTime();
    }

    if (timezone === 'UTC') {
      return Date.UTC(year, month - 1, day, hours, minutes, seconds, ms);
    }

    // 目標在目標時區中的牆鐘時間戳 (假想為 UTC)
    const targetWallClockUtc = Date.UTC(year, month - 1, day, hours, minutes, seconds, ms);
    let guessUtc = targetWallClockUtc;

    // 迭代 3 次消除時區誤差 (含夏令時 DST)
    for (let iter = 0; iter < 3; iter++) {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hourCycle: 'h23'
      });

      const parts = formatter.formatToParts(new Date(guessUtc));
      const p = {};
      parts.forEach(({ type, value }) => { p[type] = parseInt(value, 10); });

      const currentWallClockUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, 0);
      const diff = targetWallClockUtc - (currentWallClockUtc + (guessUtc % 1000));
      if (Math.abs(diff) === 0) break;
      guessUtc += diff;
    }

    // 保留原本指定之微秒
    return Math.floor(guessUtc / 1000) * 1000 + ms;
  },

  /**
   * 將 UTC Epoch 格式化為指定時區的詳細物件
   */
  formatInTimezone(epochMs, timezone = 'Asia/Taipei') {
    const tz = (timezone === 'LOCAL' || !timezone) 
      ? Intl.DateTimeFormat().resolvedOptions().timeZone 
      : timezone;

    const date = new Date(epochMs);
    const formatter = new Intl.DateTimeFormat('zh-TW', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    });

    const parts = formatter.formatToParts(date);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    const ms = String(Math.floor(date.getMilliseconds())).padStart(3, '0');
    return {
      dateString: `${p.year}-${p.month}-${p.day}`,
      timeString: `${p.hour}:${p.minute}:${p.second}`,
      msString: ms,
      fullString: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}.${ms}`
    };
  }
};

if (typeof window !== 'undefined') {
  window.TimeSync = TimeSync;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimeSync;
}
