@echo off
cd /d "%~dp0"
title XSLT Viewer Server

if not exist ".venv" (
    echo [ERROR] .venv not found. Please run install.bat first.
    pause
    exit /b 1
)

echo Starting server...
".venv\Scripts\python.exe" server.py
if %errorlevel% neq 0 (
    echo [ERROR] Server stopped with an error.
    pause
)
pause