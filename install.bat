@echo off
echo Installing Node.js dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error installing Node.js dependencies.
    pause
    exit /b %errorlevel%
)

echo Compiling extension...
call npm run compile
if %errorlevel% neq 0 (
    echo Error compiling extension.
    pause
    exit /b %errorlevel%
)

echo Installing Python dependencies...
pip install lxml
if %errorlevel% neq 0 (
    echo Error installing Python dependencies.
    pause
    exit /b %errorlevel%
)

echo.
echo Installation complete!
echo.
echo IMPORTANT:
echo If the extension fails to find lxml, please copy the path below
echo and set it in VS Code Settings under "XSLT Viewer: Python Path".
echo.
python -c "import sys; print(sys.executable)"
echo.
pause
