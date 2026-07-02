@echo off
chcp 65001 >nul
echo Fight Simulator Gameplay Pack 1 - Fight Camp MVP 2.8.26 FIX3/RECOVERY
echo Repository root: %CD%
node "%~dp0apply-gameplay-fight-camp-mvp-2.8.26-fix3.cjs"
if errorlevel 1 (
  echo Patch failed.
  exit /b 1
)
echo Patch applied.
