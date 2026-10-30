@echo off
rem Hace que el sincronizador arranque solo cada vez que se prende la PC.
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
(
  echo CreateObject^("WScript.Shell"^).Run """%~dp0iniciar-oculto.vbs""", 0, False
) > "%STARTUP%\Sincronizar Ventas NC GROUP.vbs"
echo Listo: el sincronizador va a arrancar solo con Windows.
wscript "%~dp0iniciar-oculto.vbs"
echo Ya quedo corriendo. El registro esta en sincronizar-ventas.log
pause
