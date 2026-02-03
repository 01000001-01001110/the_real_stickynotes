@ECHO off
SETLOCAL ENABLEDELAYEDEXPANSION
SETLOCAL

REM StickyNotes CLI Windows Wrapper
REM This script finds and runs the stickynotes.js CLI with Node.js

REM Get the directory where this script is located
SET "SCRIPT_DIR=%~dp0"

REM Find Node.js - check multiple locations
REM 1. Try bundled Node.js from Electron (when installed via NSIS)
SET "ELECTRON_NODE=%SCRIPT_DIR%..\..\StickyNotes.exe"
IF EXIST "%ELECTRON_NODE%" (
    REM Use the app's bundled Node via Electron
    REM Actually Electron exe can't be used as node directly, need real node
    GOTO :find_system_node
)

:find_system_node
REM 2. Try system Node.js
WHERE node >nul 2>&1
IF %ERRORLEVEL% EQU 0 (
    node "%SCRIPT_DIR%stickynotes.js" %*
    EXIT /B %ERRORLEVEL%
)

REM 3. Try common Node.js installation paths
IF EXIST "%ProgramFiles%\nodejs\node.exe" (
    "%ProgramFiles%\nodejs\node.exe" "%SCRIPT_DIR%stickynotes.js" %*
    EXIT /B %ERRORLEVEL%
)

IF EXIST "%ProgramFiles(x86)%\nodejs\node.exe" (
    "%ProgramFiles(x86)%\nodejs\node.exe" "%SCRIPT_DIR%stickynotes.js" %*
    EXIT /B %ERRORLEVEL%
)

IF EXIST "%LOCALAPPDATA%\Programs\node\node.exe" (
    "%LOCALAPPDATA%\Programs\node\node.exe" "%SCRIPT_DIR%stickynotes.js" %*
    EXIT /B %ERRORLEVEL%
)

REM 4. Try nvm-windows paths
IF EXIST "%NVM_HOME%\%NVM_SYMLINK%\node.exe" (
    "%NVM_HOME%\%NVM_SYMLINK%\node.exe" "%SCRIPT_DIR%stickynotes.js" %*
    EXIT /B %ERRORLEVEL%
)

REM Node.js not found
ECHO Error: Node.js is required to run the StickyNotes CLI.
ECHO Please install Node.js from https://nodejs.org/
EXIT /B 1
