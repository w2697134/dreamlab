@echo off
>nul chcp 65001
echo ========================================
echo   Dream Visualizer - SD Address Tool
echo ========================================
echo.

echo [Check] Detecting cpolar status...
tasklist /fi "imagename eq cpolar*" 2>nul | findstr /i "cpolar" > nul
if %errorlevel% neq 0 (
    echo [ERROR] cpolar is not running!
    echo Please start cpolar first.
    timeout /t 10
    exit /b 1
)
echo [OK] cpolar is running
echo.

echo [Get] Querying cpolar tunnel info...
powershell -NoProfile -Command "try { (Invoke-WebRequest -Uri 'http://127.0.0.1:4040/api/status/tunnels' -UseBasicParsing -TimeoutSec 5).Content | Out-File -FilePath tunnel_info.json -Encoding UTF8 } catch { }"

if not exist tunnel_info.json (
    echo [ERROR] Cannot connect to cpolar API
    echo Try: http://127.0.0.1:4040
    timeout /t 10
    exit /b 1
)

echo [Parse] Extracting SD tunnel address...
powershell -NoProfile -Command "$json = Get-Content tunnel_info.json -Raw | ConvertFrom-Json; $sd = $json.tunnels | Where-Object { $_.public_url -like '*cpolar.cn*' -and $_.public_url -like 'https*' }; if ($sd) { Write-Host $sd.public_url } else { Write-Host 'NOT_FOUND' }" > sd_url.txt

set /p sd_url=<sd_url.txt
del tunnel_info.json sd_url.txt 2>nul

if "%sd_url%"=="NOT_FOUND" (
    echo.
    echo [ERROR] Cannot find SD tunnel!
    echo.
    echo Make sure cpolar is forwarding to port 7860
    echo.
    timeout /t 60
    exit /b 1
)

echo.
echo ========================================
echo   SD Address Found!
echo ========================================
echo.
echo   %sd_url%
echo.
echo ========================================
echo   Copy this address to website settings
echo ========================================
echo.
timeout /t 120
