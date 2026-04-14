@echo off
setlocal EnableDelayedExpansion
echo ==========================================
echo  XSLT Viewer - Publisher Tool
echo ==========================================
echo.

REM Ensure Node is available (required for version read/write)
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is required but was not found in PATH.
    pause
    exit /b 1
)

REM Read latest version from the first semantic version heading in CHANGELOG.md (e.g. "## 2.2.13")
set "CHANGELOG_VERSION="
for /f "tokens=2" %%v in ('findstr /r /c:"^## [0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*$" CHANGELOG.md') do (
    if not defined CHANGELOG_VERSION set "CHANGELOG_VERSION=%%v"
)

if "!CHANGELOG_VERSION!"=="" (
    echo [ERROR] Could not read latest version from CHANGELOG.md
    echo Expected a heading like: ## 2.2.13
    pause
    exit /b 1
)

REM Read current package version
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "CUR_VERSION=%%v"
if "!CUR_VERSION!"=="" (
    echo [ERROR] Could not read version from package.json
    pause
    exit /b 1
)

echo Latest CHANGELOG version: !CHANGELOG_VERSION!
echo Current package version:  !CUR_VERSION!

REM Sync package.json version to CHANGELOG top version before publishing
if /I not "!CUR_VERSION!"=="!CHANGELOG_VERSION!" (
    echo [INFO] Syncing package.json version to !CHANGELOG_VERSION! ...
    call node -e "const fs=require('fs'); const p='./package.json'; const pkg=JSON.parse(fs.readFileSync(p,'utf8')); pkg.version=process.argv[1]; fs.writeFileSync(p, JSON.stringify(pkg,null,2)+'\n');" !CHANGELOG_VERSION!
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to update package.json version.
        pause
        exit /b %ERRORLEVEL%
    )
) else (
    echo [INFO] package.json is already aligned with CHANGELOG.
)

echo.
echo Publishing version !CHANGELOG_VERSION! (no auto-increment) ...
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
