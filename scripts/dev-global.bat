@echo off
setlocal enabledelayedexpansion

REM Coding on the Go - Global Dev Runner
REM - Links the CLI globally (npm link)
REM - Starts TypeScript compile:watch in a new window
REM - Starts global cotg-cli with chosen options in another window

REM 0) Sanity checks
if not exist package.json (
  echo [ERROR] package.json not found. Run this from the project root.
  goto :eof
)

where node >nul 2>nul || (echo [ERROR] Node.js not found on PATH.& goto :eof)
where npm  >nul 2>nul || (echo [ERROR] npm not found on PATH.& goto :eof)

echo.
echo [1/3] Linking CLI globally (npm link)...
npm link
if errorlevel 1 (
  echo.
  echo [ERROR] npm link failed. You may need to run this script as Administrator.
  echo        Alternatively, run: npm i -g .
  goto :eof
)

REM 1) Collect options
set PORT=3900
set HOST=
set TUNNEL=N

echo.
set /p PORT=Enter port [3900]: 
if "%PORT%"=="" set PORT=3900

set /p TUNNEL=Enable tunnel? (y/N): 
if /I "%TUNNEL%"=="Y" (
  set TUNNEL=Y
  set HOST=0.0.0.0
) else (
  set TUNNEL=N
  set HOST=localhost
)

echo.
echo [2/3] Starting TypeScript watch (tsc -watch) in a new window...
start "cotg-compile-watch" cmd /k "npm run compile:watch"

REM Wait for initial TS build (up to ~60s)
set OUT=out\cli\index.js
set COUNT=0
:waitbuild
if exist "%OUT%" goto :built
set /a COUNT+=1 >nul
if %COUNT% GEQ 60 (
  echo [WARN] Timed out waiting for %OUT%. Proceeding...
  goto :built
)
ping -n 2 127.0.0.1 >nul
goto :waitbuild
:built

REM 3) Compose and start the CLI (with Node fallback if shim is broken)
set STARTCMD=cotg-cli start -p %PORT%
if /I "%TUNNEL%"=="Y" set STARTCMD=%STARTCMD% --tunnel
if not "%HOST%"=="" set STARTCMD=%STARTCMD% --host %HOST%

REM Check if cotg-cli shim works; if not, use node path
for /f "usebackq delims=" %%P in (`npm prefix -g`) do set NPM_PREFIX=%%P
set NODE_CLI="%NPM_PREFIX%\node_modules\coding-on-the-go\out\cli\index.js"

for /f "usebackq delims=" %%O in (`cotg-cli --version 2^>NUL`) do set HAVE_OUT=%%O
if not defined HAVE_OUT (
  echo [INFO] Falling back to Node direct invocation.
  set STARTCMD=node %NODE_CLI% start -p %PORT%
  if /I "%TUNNEL%"=="Y" set STARTCMD=%STARTCMD% --tunnel
  if not "%HOST%"=="" set STARTCMD=%STARTCMD% --host %HOST%
)

echo.
echo [3/3] Starting CLI in a new window:
echo     %STARTCMD%
start "cotg-cli start" cmd /k "%STARTCMD%"

echo.
echo Done. Watch window rebuilds on changes; CLI window shows Local/Network/Tunnel URLs.
echo To stop, close the CLI window or press Ctrl+C in it.

endlocal
