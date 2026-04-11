@echo off
setlocal enabledelayedexpansion

for /f "tokens=1,5" %%a in ('netstat -ano ^| findstr LISTENING ^| findstr 127.0.0.1') do (
    set pid=%%b
    taskkill /F /PID !pid!
)