@echo off
REM Compila y ejecuta las pruebas del calculo de metrologia con MSVC.
cd /d "%~dp0."
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1
cl /nologo /EHsc /O2 /I..\..\src test_metrology.cpp ..\..\src\metrology.cpp /Fe:test_metrology.exe >nul
if errorlevel 1 exit /b 1
"%~dp0test_metrology.exe"
