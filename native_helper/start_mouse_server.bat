@echo off
chcp 65001 >nul
title ChronoClicker - 系統級實體滑鼠伺服器

echo =================================================================
echo  ⚡ ChronoClicker - 本機系統實體滑鼠伺服器啟動器
echo =================================================================
echo.

REM 檢查是否有 Python
where python >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] 偵測到 Python 環境，正在以 Python 啟動高效能伺服器...
    python "%~dp0chrono_mouse_server.py"
    goto end
)

REM 若無 Python，則呼叫 Windows 內建 PowerShell
echo [INFO] 未偵測到 Python，自動切換至 Windows 內建 PowerShell 模式...
powershell -ExecutionPolicy Bypass -File "%~dp0chrono_mouse_server.ps1"

:end
pause
