@echo off
echo Starting exhibit services...

:: Start 2026-kara Node app server in background
start "KaraServer" cmd /c "cd /d C:\Users\exhibit\exhibits\2026-kara && npm start"

:: Optional: wait to make sure server is running (adjust timing as needed)
timeout /t 5 /nobreak >nul

  start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk http://localhost:3333/projector.html ^
  --autoplay-policy=no-user-gesture-required ^
  --user-data-dir="C:\Users\exhibit\AppData\Local\2026-kara-exhibit" ^
  --no-first-run


exit