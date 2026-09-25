@echo off
cd /d "%~dp0"
echo CHRONO-HADITH React + React Flow
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found. Install Node.js LTS from nodejs.org first.
  pause
  exit /b 1
)
if not exist "node_modules\vite" (
  echo Installing packages (first run only)...
  call npm.cmd install
  if errorlevel 1 (
    echo Package installation failed. Check your internet connection and terminal output.
    pause
    exit /b 1
  )
)
echo Starting local development server...
call npm.cmd run dev
if errorlevel 1 (
  echo The server stopped with an error. Review the messages above.
  pause
)
