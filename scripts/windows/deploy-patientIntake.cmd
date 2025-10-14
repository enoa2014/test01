@echo off
setlocal
chcp 65001 >nul
call "%~dp0deploy-function.cmd" patientIntake

