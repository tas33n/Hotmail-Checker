@echo off

:: Check if Node.js is already installed
node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js is already installed.
    exit /b 0
)

:: Download Node.js installer
echo Downloading Node.js installer...
bitsadmin /transfer "NodeJS" https://nodejs.org/dist/v16.20.0/node-v16.20.0-x64.msi %temp%\nodejs.msi

:: Install Node.js
echo Installing Node.js...
msiexec /i %temp%\nodejs.msi /quiet /norestart

:: Verify installation
node -v >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js installation completed successfully.
) else (
    echo Node.js installation failed.
)