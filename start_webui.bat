@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0.venv312\Scripts\python.exe"
if not exist "%PYTHON_EXE%" (
  set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
)
set "APP_PORT="

if not exist "%PYTHON_EXE%" (
  echo [ERROR] Python virtual environment not found at:
  echo         %PYTHON_EXE%
  echo.
  echo Create it first, then install dependencies:
  echo   python -m venv .venv
  echo   .venv\Scripts\python.exe -m pip install -r requirements-webui.txt
  pause
  exit /b 1
)

set "PY_VERSION="
for /f "tokens=2" %%A in ('"%PYTHON_EXE%" --version 2^>^&1') do set "PY_VERSION=%%A"
for /f "tokens=1,2 delims=." %%A in ("%PY_VERSION%") do (
  set "PY_MAJOR=%%A"
  set "PY_MINOR=%%B"
)

if not "%PY_MAJOR%"=="3" (
  echo [ERROR] Unsupported Python version: %PY_MAJOR%.%PY_MINOR%
  echo         Web UI currently supports Python 3.10 to 3.12.
  echo.
  echo Recreate the virtual environment with Python 3.12, for example:
  echo   py -3.12 -m venv .venv
  echo   .venv\Scripts\python.exe -m pip install -r requirements-webui.txt
  pause
  exit /b 1
)

if %PY_MINOR% LSS 10 (
  echo [ERROR] Unsupported Python version: %PY_MAJOR%.%PY_MINOR%
  echo         Web UI currently supports Python 3.10 to 3.12.
  echo.
  echo Recreate the virtual environment with Python 3.12, for example:
  echo   py -3.12 -m venv .venv
  echo   .venv\Scripts\python.exe -m pip install -r requirements-webui.txt
  pause
  exit /b 1
)

if %PY_MINOR% GTR 12 (
  echo [ERROR] Unsupported Python version: %PY_MAJOR%.%PY_MINOR%
  echo         Web UI currently supports Python 3.10 to 3.12.
  echo.
  echo Recreate the virtual environment with Python 3.12, for example:
  echo   py -3.12 -m venv .venv
  echo   .venv\Scripts\python.exe -m pip install -r requirements-webui.txt
  pause
  exit /b 1
)

echo [INFO] Using Python: %PYTHON_EXE%
echo [INFO] Checking Web UI dependencies...
"%PYTHON_EXE%" -c "import fastapi,uvicorn,jinja2,geopandas,fiona,shapely,pyproj" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Missing dependencies detected. Installing from requirements-webui.txt ...
  "%PYTHON_EXE%" -m pip install --disable-pip-version-check -r requirements-webui.txt
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
) else (
  echo [INFO] Dependencies already installed.
)

for /f %%P in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "$listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | ForEach-Object { $_.Port }; 8000..8005 | Where-Object { $_ -notin $listeners } | Select-Object -First 1"') do (
  set "APP_PORT=%%P"
)

if not defined APP_PORT (
  echo [ERROR] No free localhost port found in range 8000-8005.
  pause
  exit /b 1
)

set "APP_URL=http://127.0.0.1:%APP_PORT%"

echo [INFO] Starting Web UI server...
echo [INFO] URL: %APP_URL%
echo [INFO] Server log opens in a separate window.
start "Field Observation Web UI Server" "%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port %APP_PORT%

echo [INFO] Waiting for server readiness...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; $url='%APP_URL%/api/health'; for($i=0; $i -lt 60; $i++) { try { $response = Invoke-RestMethod -Uri $url -TimeoutSec 2; if ($response.status -eq 'ok') { exit 0 } } catch {} Start-Sleep -Milliseconds 500 }; exit 1"
if errorlevel 1 (
  echo [ERROR] Web UI did not become ready in time.
  echo [ERROR] Check the 'Field Observation Web UI Server' window for details.
  pause
  exit /b 1
)

start "" "%APP_URL%"
echo [INFO] Browser opened at %APP_URL%
echo [INFO] You can close this launcher window.

echo.
echo [INFO] Web UI server stopped.
pause
