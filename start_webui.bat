@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
if exist "%~dp0.venv312\Scripts\python.exe" set "PYTHON_EXE=%~dp0.venv312\Scripts\python.exe"
set "APP_URL=http://127.0.0.1:8000"

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

echo [INFO] Starting Web UI server...
echo [INFO] URL: %APP_URL%
echo [INFO] This window stays open while the server is running.
echo [INFO] Press CTRL+C to stop the server.
start "" "%APP_URL%"
"%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

echo.
echo [INFO] Web UI server stopped.
pause
