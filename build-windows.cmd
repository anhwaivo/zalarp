@echo off
REM Build the ZaDark for Windows installer exe.
REM Double-click this file, or run it from cmd:  build-windows.cmd
REM
REM Package.json's "dist:pc" task cannot be used on Windows: it runs pkgMacOS
REM first, and pkg cannot cross-build macOS targets from Windows ("spawn UNKNOWN").
REM So the Windows exe is produced by calling pkg directly with only the win-x64
REM target, after gulp has compiled everything into build\.

setlocal

cd /d "%~dp0"

echo [1/2] npx gulp build
call npx gulp build
if errorlevel 1 goto :failed

echo.
echo [2/2] npx pkg ^(win-x64^)
if not exist "dist\windows" mkdir "dist\windows"

REM pkg occasionally fails with a bogus "Cannot stat ... build\pc\zadark-pc.js"
REM ENOENT even though the file is present: it races on a file it has just read.
REM Retrying always succeeds, so try a few times before giving up.
set PKG_TRY=0
:pkgexport
set /a PKG_TRY+=1
call npx pkg ./build/pc/index.js --config ./pkg.config.json --targets node16.16.0-win-x64 --output ./dist/windows/zadark.exe
if not errorlevel 1 goto :pkgok
if %PKG_TRY% GEQ 3 goto :failed
echo.
echo pkg failed ^(attempt %PKG_TRY%^), retrying ...
timeout /t 2 /nobreak >nul
goto :pkgexport

:pkgok
echo.
echo Done: dist\windows\zadark.exe
echo.
echo Before installing, close Zalo PC completely and clear the stale extraction:
echo   rmdir /s /q "%USERPROFILE%\zadark-tmp"
echo.
pause
exit /b 0

:failed
echo.
echo BUILD FAILED. See the output above.
echo.
pause
exit /b 1
