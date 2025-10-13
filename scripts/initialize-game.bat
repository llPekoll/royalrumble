@echo off
REM Domin8 Game Initialization Script for Windows
REM This batch file runs the initialize game script

echo Starting Domin8 Game Initialization...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check if we're in the right directory
if not exist "package.json" (
    echo Error: package.json not found
    echo Please run this script from the project root directory
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Run the initialization script
echo Running initialization script...
npm run script:initialize:js

if errorlevel 1 (
    echo.
    echo Initialization failed. Check the error messages above.
    pause
    exit /b 1
) else (
    echo.
    echo Initialization completed successfully!
    pause
)