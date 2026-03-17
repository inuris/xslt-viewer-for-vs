@echo off
setlocal EnableDelayedExpansion
echo ==========================================
echo  XSLT Viewer - Publisher Tool
echo ==========================================
echo.

REM Read current version from package.json using Node (required for this script)
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set CUR_VERSION=%%v
if "!CUR_VERSION!"=="" (
    echo [WARN] Could not read version from package.json
) else (
    echo Current version: !CUR_VERSION!
)
echo.

echo Select update type:
echo 1. Patch (0.0.1 - 0.0.2) [Default]
echo 2. Minor (0.0.1 - 0.1.0)
echo 3. Major (0.0.1 - 1.0.0)
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

REM Ensure vsce is installed
where vsce >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [INFO] vsce not found. Installing globally with npm...
    call npm install -g vsce
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [ERROR] Failed to install vsce via npm.
        pause
        exit /b %ERRORLEVEL%
    )
)

REM Load local publish environment if present (VSCODE_MARKETPLACE_TOKEN, OVSX_PAT, etc.)
if exist publish-env.bat (
    call publish-env.bat
)

REM Expect both tokens (do NOT commit publish-env.bat)
if "!VSCODE_MARKETPLACE_TOKEN!"=="" (
    echo [ERROR] Please set VSCODE_MARKETPLACE_TOKEN in publish-env.bat
    pause
    exit /b 1
)
if "!OVSX_PAT!"=="" (
    echo [ERROR] Please set OVSX_PAT in publish-env.bat
    pause
    exit /b 1
)

REM Sanitize tokens to handle newlines or special chars
setlocal
echo %VSCODE_MARKETPLACE_TOKEN% > temp_vs_token.txt
for /f "delims=" %%a in (temp_vs_token.txt) do (
    endlocal
    set "VS_TOKEN=%%a"
    setlocal
)
del temp_vs_token.txt

setlocal
echo %OVSX_PAT% > temp_ovsx_token.txt
for /f "delims=" %%a in (temp_ovsx_token.txt) do (
    endlocal
    set "OVSX_TOKEN=%%a"
    setlocal
)
del temp_ovsx_token.txt
endlocal
setlocal EnableDelayedExpansion

echo.
echo [1/2] Publishing to VS Code Marketplace...
@REM Use a test file to communicate with process
(echo y) | vsce publish -p %VS_TOKEN%
set "VSCE_CODE=%ERRORLEVEL%"
if "%VSCE_CODE%"=="0" (
    echo [SUCCESS] Published to VS Code Marketplace
) else if "%ARG%"=="" (
    echo [WARN] VS Code Marketplace publish failed. Continuing to Open VSX...
) else (
    echo.
    echo [ERROR] VS Code Marketplace publish failed.
    pause
    exit /b %VSCE_CODE%
)

echo.
echo [2/2] Publishing to Open VSX (Eclipse / Cursor)...
call npx ovsx publish -p %OVSX_TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Open VSX publish failed.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [SUCCESS] Published to both VS Code Marketplace and Open VSX!
pause
