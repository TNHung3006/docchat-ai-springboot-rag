@echo off
chcp 65001 >nul
echo ===================================================
echo   KIEM TRA CONG 8080 TRUOC KHI KHOI DONG...
echo ===================================================
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080" ^| findstr "LISTENING"') do (
    echo Dang tat tien trinh cu tren cong 8080 ^(PID: %%a^)...
    taskkill /F /PID %%a >nul 2>&1
)

echo ===================================================
echo   DANG KHOI DONG DOCCHAT AI (PORT 8080)...
echo   Trinh duyet se tu dong mo ngay khi Server san sang!
echo ===================================================
call .\mvnw.cmd spring-boot:run
pause
