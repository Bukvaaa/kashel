@echo off
cd /d "%~dp0"
title Кошель

if not exist "node_modules\electron\dist\electron.exe" (
  echo Первый запуск: устанавливаю зависимости, это займёт пару минут...
  call npm install
  if errorlevel 1 goto error
)

rem Sobiraem interfejs tolko esli dist net ili ishodniki novee poslednej sborki
set NEED_BUILD=0
if not exist "dist\index.html" set NEED_BUILD=1
if "%NEED_BUILD%"=="0" powershell -NoProfile -ExecutionPolicy Bypass -Command "$d=(Get-Item -LiteralPath dist\index.html).LastWriteTime; $n=Get-ChildItem src,index.html,vite.config.ts,tsconfig.json,package.json -Recurse -File | Where-Object { $_.LastWriteTime -gt $d } | Select-Object -First 1; if ($n) { exit 1 } else { exit 0 }"
if errorlevel 1 set NEED_BUILD=1
if "%NEED_BUILD%"=="1" (
  echo Собираю интерфейс...
  call npm run build
  if errorlevel 1 goto error
)

echo Запускаю Кошель...
start "" "%~dp0node_modules\electron\dist\electron.exe" "%~dp0."
exit /b 0

:error
echo.
echo Не получилось. Прочитайте сообщение выше и нажмите любую клавишу.
pause >nul
exit /b 1
