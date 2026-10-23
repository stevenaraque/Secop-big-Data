@echo off
rem RF-26: ejecutor del scheduler sin Celery. Lo invoca el Programador de tareas
rem cada 30 min; el comando decide si vence o no (idempotente).
setlocal
set "PYTHONPATH=%~dp0secop_backend"
cd /d "%~dp0"
if not exist "%~dp0logs" mkdir "%~dp0logs"

rem Rotacion simple: si el log pasa de 5 MB se archiva como .old
if exist "%~dp0logs\actualizacion.log" for %%A in ("%~dp0logs\actualizacion.log") do if %%~zA GTR 5242880 move /y "%~dp0logs\actualizacion.log" "%~dp0logs\actualizacion.old.log" >nul 2>&1

echo [%date% %time%] tick >> "%~dp0logs\actualizacion.log"
"%~dp0venv\Scripts\python.exe" "%~dp0secop_backend\manage.py" actualizar_automatica >> "%~dp0logs\actualizacion.log" 2>&1
endlocal
