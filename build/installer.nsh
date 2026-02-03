; StickyNotes Custom NSIS Installer Script
; =========================================
; This file is included by electron-builder during the NSIS installer build.
; It adds custom installation/uninstallation logic for Windows.
;
; Features:
; - Auto-start on Windows boot (registry entry)
; - CLI added to PATH for command-line access
; - File association for .stickynote files
; - Clean uninstall (removes registry entries and CLI from PATH)
; - Shell integration refresh
;
; Documentation:
; - NSIS: https://nsis.sourceforge.io/Docs/
; - electron-builder: https://www.electron.build/configuration/nsis

!include "MUI2.nsh"

; ============================================================================
; CUSTOM INSTALL MACRO
; ============================================================================
; Called during installation after files are copied.
; Adds registry entries for auto-start and file associations.

!macro customInstall
  ; ----- Auto-start on Windows boot -----
  ; Add to Windows startup registry key so StickyNotes starts when user logs in
  ; Uses HKCU (current user) instead of HKLM to avoid requiring admin privileges
  ; The --minimized flag ensures the app starts minimized to system tray
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
    "StickyNotes" '"$INSTDIR\StickyNotes.exe" --minimized'

  ; ----- Add CLI to PATH -----
  ; Add the CLI directory to user PATH so 'stickynotes' command works globally
  ; Read current PATH
  ReadRegStr $0 HKCU "Environment" "Path"
  ; Append CLI directory (only if not already present - simple check)
  StrCpy $0 "$0;$INSTDIR\resources\app.asar.unpacked\cli\bin"
  ; Write updated PATH
  WriteRegExpandStr HKCU "Environment" "Path" "$0"
  ; Notify system of environment change
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000

  ; ----- File association for .stickynote files -----
  ; Step 1: Register the .stickynote extension
  WriteRegStr HKCR ".stickynote" "" "StickyNotes.Document"
  WriteRegStr HKCR ".stickynote" "Content Type" "application/stickynote"

  ; Step 2: Define the StickyNotes.Document file type
  WriteRegStr HKCR "StickyNotes.Document" "" "StickyNotes Document"
  WriteRegStr HKCR "StickyNotes.Document" "FriendlyTypeName" "StickyNotes Document"

  ; Step 3: Set the icon for .stickynote files
  ; Uses the main executable icon (index 0)
  WriteRegStr HKCR "StickyNotes.Document\DefaultIcon" "" "$INSTDIR\StickyNotes.exe,0"

  ; Step 4: Define the "open" command for .stickynote files
  ; %1 is replaced with the file path when a .stickynote file is double-clicked
  WriteRegStr HKCR "StickyNotes.Document\shell\open\command" "" '"$INSTDIR\StickyNotes.exe" "%1"'

  ; Step 5: Add additional shell verbs (optional)
  ; "Edit" command - same as "open" for now, but can be customized later
  WriteRegStr HKCR "StickyNotes.Document\shell\edit" "" "Edit with StickyNotes"
  WriteRegStr HKCR "StickyNotes.Document\shell\edit\command" "" '"$INSTDIR\StickyNotes.exe" "%1"'

  ; ----- Refresh Windows Explorer -----
  ; Notify Windows that file associations have changed
  ; This ensures the changes take effect immediately without requiring a reboot
  ; 0x08000000 = SHCNE_ASSOCCHANGED
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

; ============================================================================
; CUSTOM UNINSTALL MACRO
; ============================================================================
; Called during uninstallation before files are removed.
; Removes registry entries added during installation.

!macro customUnInstall
  ; ----- Remove auto-start registry entry -----
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "StickyNotes"

  ; ----- Remove CLI from PATH using PowerShell -----
  ; Use nsExec to run PowerShell command that removes CLI from PATH
  nsExec::ExecToLog 'powershell -ExecutionPolicy Bypass -Command "\
    $$cliPath = [regex]::Escape(\"$INSTDIR\resources\app.asar.unpacked\cli\bin\"); \
    $$currentPath = [Environment]::GetEnvironmentVariable(\"Path\", \"User\"); \
    $$newPath = ($$currentPath -split \";\" | Where-Object { $$_ -notmatch $$cliPath }) -join \";\"; \
    [Environment]::SetEnvironmentVariable(\"Path\", $$newPath, \"User\")"'

  ; Notify system of environment change
  SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000

  ; ----- Remove file association -----
  ; Remove the .stickynote extension registration
  DeleteRegKey HKCR ".stickynote"

  ; Remove the StickyNotes.Document file type registration
  ; This also removes all subkeys (DefaultIcon, shell\open\command, etc.)
  DeleteRegKey HKCR "StickyNotes.Document"

  ; ----- Refresh Windows Explorer -----
  ; Notify Windows that file associations have been removed
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'

  ; ----- Note about user data -----
  ; User data is stored in %APPDATA%\StickyNotes and is NOT deleted during uninstall.
  ; This preserves notes, settings, and database if the user reinstalls later.
  ; To add a custom page asking if user wants to delete data, implement customUninstallPage macro.
!macroend

; ============================================================================
; CUSTOM UNINSTALL PAGE (OPTIONAL)
; ============================================================================
; Placeholder for future implementation.
; Could add a custom page asking user if they want to keep or delete their notes.
;
; Example implementation:
; !macro customUninstallPage
;   Page custom UninstallDataPage
;
;   Function UninstallDataPage
;     ; Create custom page with checkbox
;     ; If checked, delete %APPDATA%\StickyNotes
;   FunctionEnd
; !macroend

; ============================================================================
; CUSTOM HEADER (OPTIONAL)
; ============================================================================
; Placeholder for custom header configuration if needed.
; electron-builder handles most header configuration via electron-builder.yml

; ============================================================================
; END OF CUSTOM NSIS SCRIPT
; ============================================================================
