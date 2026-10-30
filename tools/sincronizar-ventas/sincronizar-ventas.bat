@echo off
rem Sube a la app las facturas y notas de credito de la carpeta Ventas NC GROUP (ventana visible).
cd /d "%~dp0"
node sincronizar-ventas.mjs
pause
