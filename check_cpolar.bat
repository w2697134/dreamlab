@echo off
chcp 65001 > nul
echo ========================================
echo   梦境可视化 - SD 地址自动获取
echo ========================================
echo.

REM 检查 cpolar 是否运行
tasklist /fi "imagename eq cpolar*" | findstr /i "cpolar" > nul
if %errorlevel% neq 0 (
    echo [错误] cpolar 未运行！
    echo 请先启动 cpolar 再运行此脚本。
    pause
    exit /b 1
)
echo [OK] cpolar 正在运行
echo.

REM 调用 cpolar 本地 API 获取隧道状态
echo [获取] 正在查询 cpolar 隧道信息...
curl -s http://127.0.0.1:4040/api/status/tunnels  > tunnel_info.json 2>nul

REM 如果 4040 端口不行，试试 4042
if %errorlevel% neq 0 (
    curl -s http://127.0.0.1:4042/api/status/tunnels > tunnel_info.json 2>nul
)

REM 提取 https 地址
findstr /i "https://" tunnel_info.json > temp_https.txt

if exist temp_https.txt (
    echo.
    echo ========================================
    echo   找到的 SD 地址（复制下面这行）：
    echo ========================================
    for /f "delims=" %%a in (temp_https.txt) do (
        echo %%a
    )
    echo ========================================
    echo.
    echo [完成] 请把这个地址填入网站的 SD 配置中
    del tunnel_info.json temp_https.txt 2>nul
) else (
    echo.
    echo [提示] 无法自动获取地址
    echo.
    echo 请查看 cpolar 窗口中的 Forwarding 行：
    echo   Forwarding  https://xxxxx.r8.vip.cpolar.cn -> http://localhost:7860
    echo.
    echo 复制 https:// 后面的地址即可。
    del tunnel_info.json 2>nul
)

echo.
pause
