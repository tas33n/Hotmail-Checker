@echo off

:: Check if Node.js is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js is not installed. Please install Node.js version 16 or higher.
    exit /b 1
)

:: Check Node.js version
for /f "tokens=1,2 delims=v." %%a in ('node -v') do (
    set major=%%a
    set minor=%%b
)

if %major% lss 16 (
    echo Node.js version 16 or higher is required. Please update Node.js.
    exit /b 1
)

:: Check if node_modules folder exists
if not exist "node_modules" (
    echo node_modules folder not found. Running npm install...
    npm install
)

:: Run the script
node index.js