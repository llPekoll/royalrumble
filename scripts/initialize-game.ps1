#!/usr/bin/env pwsh
# Domin8 Game Initialization Script for PowerShell
# This script runs the initialize game script

Write-Host "Starting Domin8 Game Initialization..." -ForegroundColor Green
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Cyan
} catch {
    Write-Host "Error: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found" -ForegroundColor Red
    Write-Host "Please run this script from the project root directory" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Run the initialization script
Write-Host "Running initialization script..." -ForegroundColor Yellow
npm run script:initialize:js

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Initialization failed. Check the error messages above." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
} else {
    Write-Host ""
    Write-Host "Initialization completed successfully!" -ForegroundColor Green
    Read-Host "Press Enter to exit"
}