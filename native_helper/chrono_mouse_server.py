#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ChronoClicker - 本機系統級真實硬體滑鼠連線服務 (Windows Hardware Mouse Server)
提供真正作業系統核心層級的滑鼠移動與實體點擊（呼叫 Windows user32.dll 原生 API）
能 100% 穿透所有瀏覽器沙盒限制、反爬蟲偵測、isTrusted 驗證、Vue/Nuxt 阻擋與 Shadow DOM。
"""

import sys
import os
import json
import time
import ctypes
from http.server import HTTPServer, BaseHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 28888

# Windows Win32 API 常數定義
MOUSEEVENTF_MOVE     = 0x0001
MOUSEEVENTF_LEFTDOWN = 0x0002
MOUSEEVENTF_LEFTUP   = 0x0004
MOUSEEVENTF_RIGHTDOWN= 0x0008
MOUSEEVENTF_RIGHTUP  = 0x0010
MOUSEEVENTF_ABSOLUTE = 0x8000

class POINT(ctypes.Structure):
    _fields_ = [("x", ctypes.c_long), ("y", ctypes.c_long)]

user32 = None
if sys.platform == "win32":
    user32 = ctypes.windll.user32
    # 啟用 Per-Monitor DPI 感知，確保 SetCursorPos 與 GetCursorPos 處理真正的物理螢幕像素
    try:
        ctypes.windll.shcore.SetProcessDpiAwareness(2) # PROCESS_PER_MONITOR_DPI_AWARE
    except Exception:
        try:
            ctypes.windll.user32.SetProcessDPIAware()
        except Exception:
            pass

def get_current_cursor_pos():
    if not user32:
        return 0, 0
    pt = POINT()
    user32.GetCursorPos(ctypes.byref(pt))
    return pt.x, pt.y

def perform_hardware_click(screen_x, screen_y, repeat=1, interval_ms=50, button="left", activate_window=True):
    """
    透過 Windows Win32 user32.dll 派發系統級實體滑鼠點擊
    """
    if not user32:
        return False, "Non-Windows OS not currently supported for Win32 API"

    try:
        target_x = int(round(screen_x))
        target_y = int(round(screen_y))

        # 1. 移動滑鼠游標至指定螢幕物理像素位置
        user32.SetCursorPos(target_x, target_y)
        time.sleep(0.01) # 微秒緩衝確保作業系統游標定位穩定

        # 2. 若指定激活視窗，確保目標視窗置於頂層接收點擊，避免第一擊被 Windows 焦點吞噬
        if activate_window:
            try:
                pt = POINT(target_x, target_y)
                hwnd = user32.WindowFromPoint(pt)
                if hwnd:
                    root_hwnd = user32.GetAncestor(hwnd, 2) # GA_ROOT
                    target_hwnd = root_hwnd if root_hwnd else hwnd
                    user32.SetForegroundWindow(target_hwnd)
                    time.sleep(0.015)
            except Exception:
                pass

        down_flag = MOUSEEVENTF_LEFTDOWN if button == "left" else MOUSEEVENTF_RIGHTDOWN
        up_flag   = MOUSEEVENTF_LEFTUP if button == "left" else MOUSEEVENTF_RIGHTUP

        for i in range(repeat):
            # 3. 模擬真實物理按壓
            user32.mouse_event(down_flag, 0, 0, 0, 0)
            # 人體工學真實點擊停留時間 (25ms ~ 35ms)，防止被視為異常微秒脈衝
            time.sleep(0.03)
            # 4. 模擬真實物理釋放
            user32.mouse_event(up_flag, 0, 0, 0, 0)

            if i < repeat - 1 and interval_ms > 0:
                time.sleep(interval_ms / 1000.0)

        return True, None
    except Exception as e:
        return False, str(e)

class MouseRequestHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        self._send_cors_headers()

        if self.path == "/status" or self.path == "/":
            cx, cy = get_current_cursor_pos()
            payload = {
                "status": "ready",
                "service": "ChronoClicker OS Hardware Mouse Server",
                "version": "1.2.0",
                "platform": sys.platform,
                "cursor": {"x": cx, "y": cy}
            }
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if self.path == "/cursor":
            cx, cy = get_current_cursor_pos()
            body = json.dumps({"x": cx, "y": cy}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        self._send_cors_headers()

        if self.path == "/click":
            try:
                content_len = int(self.headers.get("Content-Length", 0))
                post_data = self.rfile.read(content_len)
                data = json.loads(post_data.decode("utf-8"))

                # 優先使用經過 DPI 縮放計算的真實物理像素座標 (physicalX, physicalY)
                physical_x = data.get("physicalX")
                physical_y = data.get("physicalY")
                screen_x = data.get("screenX")
                screen_y = data.get("screenY")

                target_x = physical_x if physical_x is not None else screen_x
                target_y = physical_y if physical_y is not None else screen_y

                repeat = int(data.get("repeat", 1))
                interval_ms = int(data.get("interval", 50))
                button = data.get("button", "left")
                activate_window = data.get("activateWindow", True)

                if target_x is None or target_y is None:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'{"error": "Missing screenX/screenY or physicalX/physicalY"}')
                    return

                ok, err = perform_hardware_click(target_x, target_y, repeat, interval_ms, button, activate_window)

                if ok:
                    resp = json.dumps({
                        "success": True,
                        "screenX": screen_x,
                        "screenY": screen_y,
                        "physicalX": target_x,
                        "physicalY": target_y,
                        "repeat": repeat,
                        "timestamp": int(time.time() * 1000)
                    }).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(resp)))
                    self.end_headers()
                    self.wfile.write(resp)
                    print(f"[{time.strftime('%H:%M:%S')}] 🖱️ 系統級實體點擊觸發成功: 物理座標 ({target_x}, {target_y}) (CSS: {screen_x}, {screen_y}) | 連點 {repeat} 次")
                else:
                    resp = json.dumps({"success": False, "error": err}).encode("utf-8")
                    self.send_response(500)
                    self.send_header("Content-Type", "application/json; charset=utf-8")
                    self.send_header("Content-Length", str(len(resp)))
                    self.end_headers()
                    self.wfile.write(resp)
            except Exception as ex:
                resp = json.dumps({"success": False, "error": str(ex)}).encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
            return

        self.send_response(404)
        self.end_headers()

    def log_message(self, format, *args):
        # 抑制普通 HTTP 輪詢 access log，保持終端清爽
        pass

def run():
    server_address = (HOST, PORT)
    httpd = HTTPServer(server_address, MouseRequestHandler)
    print("=" * 65)
    print(" ⚡ ChronoClicker - 系統級實體滑鼠連線服務已啟動")
    print(f" 🌐 監聽位址: http://{HOST}:{PORT}")
    print(" 🔒 支援 Windows user32.dll 原生實體滑鼠硬體級驅動點擊")
    print(" 🎯 專治: ticketplus.com.tw、拓元、KKTIX 等反爬蟲/isTrusted 阻擋")
    print(" 💡 保持此視窗開啟，ChronoClicker 擴充功能將自動連線並調用本機滑鼠！")
    print("=" * 65)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服務已停止。")
        httpd.server_close()

if __name__ == "__main__":
    run()
