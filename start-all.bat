@echo off
title QuickKart - All Services
echo Starting QuickKart: API (:4000), Customer (:3000), Ops (:3001)
echo Groceries. Delivered Quickly.
echo Close this window to stop everything.
cd /d "%~dp0"

start "QuickKart API" cmd /k "cd server && npm run dev"
start "QuickKart Customer App" cmd /k "cd customer-app && npm run dev"
start "QuickKart Ops App" cmd /k "cd ops-app && npm run dev"

timeout /t 6 >nul
start http://localhost:3000
start http://localhost:3001
echo All QuickKart services started!
pause
