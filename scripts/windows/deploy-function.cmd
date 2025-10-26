@echo off
setlocal ENABLEDELAYEDEXPANSION
chcp 65001 >nul

if "%~1"=="" (
  echo 用法: %~n0 ^<functionName^>
  echo 例如: %~n0 patientIntake
  exit /b 1
)

set FN=%~1
pushd %~dp0\..\..
echo 开始部署云函数: %FN%
node scripts\deploy-cloudfunctions.js %FN%
set ERR=%ERRORLEVEL%
popd

if not "%ERR%"=="0" (
  echo 部署失败（错误码 %ERR%）
  exit /b %ERR%
)

echo 部署成功: %FN%
pause

