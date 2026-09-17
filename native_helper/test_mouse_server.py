#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ChronoClicker - 本機系統滑鼠伺服器自我測試腳本
測試 /status 與 /click 端點是否正常回應
"""

import sys
import json
import urllib.request
import urllib.error

def test_server():
    base_url = "http://127.0.0.1:28888"
    print("Testing connection to:", base_url)

    # 1. 測試 /status
    try:
        req = urllib.request.Request(f"{base_url}/status")
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print("✅ GET /status OK:", data)
    except Exception as e:
        print("❌ GET /status failed (is server running?):", e)
        return False

    # 2. 測試 /cursor
    try:
        req = urllib.request.Request(f"{base_url}/cursor")
        with urllib.request.urlopen(req, timeout=2) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print("✅ GET /cursor OK:", data)
    except Exception as e:
        print("❌ GET /cursor failed:", e)

    return True

if __name__ == "__main__":
    test_server()
