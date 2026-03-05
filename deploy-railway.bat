@echo off
echo ==========================================
echo Railway Deployment Script
echo ==========================================
echo.

echo Step 1: Logging into Railway...
railway login
if %errorlevel% neq 0 (
    echo Login failed. Please try again.
    pause
    exit /b 1
)

echo.
echo Step 2: Linking to project...
cd /d "c:\Users\walea\playwright-agents\apps\grc-tool"
railway link

echo.
echo Step 3: Deploying Backend...
cd /d "c:\Users\walea\playwright-agents\apps\grc-tool\backend"
railway up --detach

echo.
echo Step 4: Deploying Frontend...
cd /d "c:\Users\walea\playwright-agents\apps\grc-tool\frontend"
railway up --detach

echo.
echo ==========================================
echo Deployment initiated!
echo Check Railway dashboard for status.
echo ==========================================
pause
