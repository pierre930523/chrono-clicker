<#
.SYNOPSIS
ChronoClicker - 本機系統級真實硬體滑鼠連線服務 (PowerShell 原生版本)
無需安裝 Python，Windows 內建 PowerShell 直接執行。
#>

$hostAddress = "http://127.0.0.1:28888/"

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# 引入 Win32 mouse_event, SetCursorPos, SetProcessDPIAware API
$signature = @"
[DllImport("user32.dll", CharSet=CharSet.Auto, CallingConvention=CallingConvention.StdCall)]
public static extern void mouse_event(long dwFlags, long dx, long dy, long cButtons, long dwExtraInfo);
[DllImport("user32.dll")]
public static extern bool SetCursorPos(int X, int Y);
[DllImport("user32.dll")]
public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")]
public static extern IntPtr WindowFromPoint(System.Drawing.Point p);
[DllImport("user32.dll")]
public static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
"@
$win32 = Add-Type -memberDefinition $signature -name "Win32MouseHelper" -namespace ChronoClicker -passThru
try { [ChronoClicker.Win32MouseHelper]::SetProcessDPIAware() | Out-Null } catch {}

$MOUSEEVENTF_LEFTDOWN  = 0x0002
$MOUSEEVENTF_LEFTUP    = 0x0004
$MOUSEEVENTF_RIGHTDOWN = 0x0008
$MOUSEEVENTF_RIGHTUP   = 0x0010

function Send-CORSHeaders($response) {
    $response.Headers.Add("Access-Control-Allow-Origin", "*")
    $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($hostAddress)

try {
    $listener.Start()
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host " ⚡ ChronoClicker - 系統級實體滑鼠連線服務 (PowerShell 版) 已啟動" -ForegroundColor Green
    Write-Host " 🌐 監聽位址: $hostAddress" -ForegroundColor White
    Write-Host " 🔒 支援 Windows user32.dll 原生實體滑鼠硬體級驅動點擊" -ForegroundColor Yellow
    Write-Host " 🎯 專治: ticketplus.com.tw、拓元、KKTIX 等反爬蟲/isTrusted 阻擋" -ForegroundColor Magenta
    Write-Host " 💡 保持此視窗開啟，擴充功能將自動連線並調用本機滑鼠！" -ForegroundColor Gray
    Write-Host "=================================================================" -ForegroundColor Cyan

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        Send-CORSHeaders($response)

        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }

        $rawUrl = $request.RawUrl

        if ($request.HttpMethod -eq "GET" -and ($rawUrl -eq "/status" -or $rawUrl -eq "/")) {
            $pos = [System.Windows.Forms.Cursor]::Position
            $json = @{
                status   = "ready"
                service  = "ChronoClicker OS Hardware Mouse Server (PowerShell)"
                version  = "1.2.0"
                platform = "windows"
                cursor   = @{ x = $pos.X; y = $pos.Y }
            } | ConvertTo-Json

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($json)
            $response.ContentType = "application/json; charset=utf-8"
            $response.ContentLength64 = $buffer.Length
            $response.OutputStream.Write($buffer, 0, $buffer.Length)
            $response.Close()
            continue
        }

        if ($request.HttpMethod -eq "POST" -and $rawUrl -eq "/click") {
            try {
                $reader = New-Object System.IO.StreamReader($request.InputStream, $request.ContentEncoding)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $data = $body | ConvertFrom-Json
                $screenX = if ($data.screenX -ne $null) { [int]$data.screenX } else { $null }
                $screenY = if ($data.screenY -ne $null) { [int]$data.screenY } else { $null }
                $physicalX = if ($data.physicalX -ne $null) { [int]$data.physicalX } else { $screenX }
                $physicalY = if ($data.physicalY -ne $null) { [int]$data.physicalY } else { $screenY }

                $repeat = if ($data.repeat) { [int]$data.repeat } else { 1 }
                $interval = if ($data.interval) { [int]$data.interval } else { 50 }
                $button = if ($data.button) { $data.button } else { "left" }

                [ChronoClicker.Win32MouseHelper]::SetCursorPos($physicalX, $physicalY)
                Start-Sleep -Milliseconds 10

                try {
                    $pt = New-Object System.Drawing.Point($physicalX, $physicalY)
                    $hwnd = [ChronoClicker.Win32MouseHelper]::WindowFromPoint($pt)
                    if ($hwnd -ne [IntPtr]::Zero) {
                        $rootHwnd = [ChronoClicker.Win32MouseHelper]::GetAncestor($hwnd, 2)
                        $targetHwnd = if ($rootHwnd -ne [IntPtr]::Zero) { $rootHwnd } else { $hwnd }
                        [ChronoClicker.Win32MouseHelper]::SetForegroundWindow($targetHwnd) | Out-Null
                        Start-Sleep -Milliseconds 15
                    }
                } catch {}

                $down = if ($button -eq "left") { $MOUSEEVENTF_LEFTDOWN } else { $MOUSEEVENTF_RIGHTDOWN }
                $up   = if ($button -eq "left") { $MOUSEEVENTF_LEFTUP } else { $MOUSEEVENTF_RIGHTUP }

                for ($i = 0; $i -lt $repeat; $i++) {
                    [ChronoClicker.Win32MouseHelper]::mouse_event($down, 0, 0, 0, 0)
                    Start-Sleep -Milliseconds 30
                    [ChronoClicker.Win32MouseHelper]::mouse_event($up, 0, 0, 0, 0)

                    if ($i -lt ($repeat - 1) -and $interval -gt 0) {
                        Start-Sleep -Milliseconds $interval
                    }
                }

                $respJson = @{
                    success   = $true
                    screenX   = $screenX
                    screenY   = $screenY
                    physicalX = $physicalX
                    physicalY = $physicalY
                    repeat    = $repeat
                } | ConvertTo-Json

                $buffer = [System.Text.Encoding]::UTF8.GetBytes($respJson)
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()

                $timeStr = (Get-Date).ToString("HH:mm:ss")
                Write-Host "[$timeStr] 🖱️ 實體滑鼠點擊完成: 物理座標 ($physicalX, $physicalY) (CSS: $screenX, $screenY) | 連點 $repeat 次" -ForegroundColor Green
            } catch {
                $errJson = @{ success = $false; error = $_.Exception.Message } | ConvertTo-Json
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($errJson)
                $response.StatusCode = 500
                $response.ContentType = "application/json; charset=utf-8"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
            }
            continue
        }

        $response.StatusCode = 404
        $response.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
