@echo off
setlocal
echo ==========================================
echo  XSLT Viewer - Publisher Tool
echo ==========================================
echo.
echo Select update type:
echo 1. Patch (0.0.1 -> 0.0.2) [Default]
echo 2. Minor (0.0.1 -> 0.1.0)
echo 3. Major (0.0.1 -> 1.0.0)
echo 4. Publish current version (no auto-increment)
echo.

set /p choice="Enter choice (1-4): "
if "%choice%"=="" set choice=1

set ARG=patch
if "%choice%"=="1" set ARG=patch
if "%choice%"=="2" set ARG=minor
if "%choice%"=="3" set ARG=major
if "%choice%"=="4" set ARG=

echo.
echo Publishing with argument: "%ARG%" ...
echo (If prompted about missing repository/license, the script will auto-answer 'y')
echo.

REM Pipe 'y' to auto-accept potential warnings about missing LICENSE/Repo
echo y | call vsce publish %ARG% -p 1aXLOHGBKsIxdFo7kqgtitkjNrOL8uJu846J4UReV4O9hl8ybV7YJQQJ99CAACAAAAAAAAAAAAASAZDOoywu

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Publishing failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Published successfully!
pause
