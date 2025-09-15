@echo off
setlocal enabledelayedexpansion

REM Release Dry-Run Script
REM - Unlinks any global npm link for this package
REM - Uninstalls any globally installed version
REM - Builds the project (TS + React)
REM - Packs tarball with npm pack
REM - Installs the tarball globally
REM - Verifies the global command

set PKG_NAME=coding-on-the-go

where node >nul 2>nul || (echo [ERROR] Node.js not found on PATH.& goto :eof)
where npm  >nul 2>nul || (echo [ERROR] npm not found on PATH.& goto :eof)

if not exist package.json (
  echo [ERROR] package.json not found. Run from the project root.
  goto :eof
)

echo.
echo [1/6] Unlinking any global npm link for %PKG_NAME% ...
call npm unlink -g %PKG_NAME%
echo   (ignored errors above if not linked)

echo.
echo [2/6] Uninstalling any globally installed %PKG_NAME% ...
call npm un -g %PKG_NAME%
echo   (ignored errors above if not installed)

echo.
echo [3/6] Building project (agent + compile + react)...
call npm run build
if errorlevel 1 (
  echo [ERROR] Build failed.
  goto :eof
)

echo.
echo [4/6] Packing npm tarball (npm pack)...
for /f "usebackq delims=" %%F in (`npm pack`) do set TAR=%%F
if not defined TAR (
  echo [ERROR] Could not determine packed tarball name.
  goto :eof
)
echo   Tarball: %TAR%

echo.
echo [5/6] Installing tarball globally: %TAR%
call npm i -g "%TAR%"
if errorlevel 1 (
  echo [ERROR] Global install from tarball failed. Try running this script as Administrator.
  goto :eof
)

echo.
echo [6/6] Verifying global CLI ...
where cotg-cli
if errorlevel 1 (
  echo [WARN] Global shim not found on PATH. Ensure your npm global bin is on PATH.
) else (
  cotg-cli --help
)

echo.
echo Done. You can now test: cotg-cli start -p 3900 --tunnel
echo To remove this global install: npm un -g %PKG_NAME%

endlocal

