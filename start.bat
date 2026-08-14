@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   HACCP AI Assistant - 一键启动
echo   页面地址: http://localhost:8000/
echo   按 Ctrl+C 停止后端
echo ============================================
echo.
echo 正在启动后端并打开浏览器...
start "" /b cmd /c "timeout /t 6 /nobreak >nul & start "" http://localhost:8000/"
python -m uvicorn backend.main:app --port 8000
pause
