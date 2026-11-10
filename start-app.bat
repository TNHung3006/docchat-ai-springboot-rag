@echo off
chcp 65001 >nul
echo ===================================================
echo   DANG KHOI DONG DOCCHAT AI (PORT 8080)...
echo   Trinh duyet se tu dong mo sau vai giay!
echo ===================================================
start "" cmd /c "timeout /t 7 >nul && start http://localhost:8080"
call .\mvnw.cmd spring-boot:run
pause
