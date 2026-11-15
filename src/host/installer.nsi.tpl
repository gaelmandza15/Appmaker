Unicode true
!include "MUI2.nsh"

!define APP_NAME "{{APP_NAME}}"
!define APP_VERSION "{{APP_VERSION}}"
!define APP_PUBLISHER "{{APP_PUBLISHER}}"
!define APP_EXE "{{APP_EXE}}"
!define APP_ID "{{APP_ID}}"
!define APP_DESCRIPTION "{{APP_DESCRIPTION}}"
!define PAYLOAD "{{PAYLOAD_DIR}}"
!define ICON_FILE "{{ICON_PATH}}"
!define WEBVIEW2_BOOTSTRAPPER "{{WEBVIEW2_BOOTSTRAPPER}}"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"

Name "${APP_NAME}"
BrandingText "${APP_NAME} — ${APP_PUBLISHER}"
OutFile "{{OUTPUT_FILE}}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "Software\${APP_ID}" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails nevershow
ShowUninstDetails nevershow

VIProductVersion "{{APP_VERSION_4}}"
VIAddVersionKey /LANG=1036 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1036 "FileDescription" "${APP_DESCRIPTION}"
VIAddVersionKey /LANG=1036 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1036 "ProductVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1036 "CompanyName" "${APP_PUBLISHER}"
VIAddVersionKey /LANG=1036 "LegalCopyright" "${APP_PUBLISHER}"

!define MUI_ABORTWARNING
!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer ${APP_NAME}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ; WebView2 est fourni par Windows 11 et par la plupart des Windows 10 à jour.
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" 0 wv_ready
  ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" "pv"
  StrCmp $0 "" 0 wv_ready

  !if "${WEBVIEW2_BOOTSTRAPPER}" != ""
    InitPluginsDir
    SetOutPath "$PLUGINSDIR"
    File "${WEBVIEW2_BOOTSTRAPPER}"
    DetailPrint "Installation de Microsoft Edge WebView2…"
    ExecWait '"$PLUGINSDIR\MicrosoftEdgeWebview2Setup.exe" /silent /install'
    Goto wv_ready
  !endif

  MessageBox MB_ICONEXCLAMATION|MB_OK "Microsoft Edge WebView2 est requis pour afficher cette application.$\r$\n$\r$\nInstallez-le depuis https://developer.microsoft.com/microsoft-edge/webview2/ puis relancez l’installation."
  Abort

  wv_ready:
FunctionEnd

Section "Application" SecApplication
  SetOutPath "$INSTDIR"
  File "${PAYLOAD}\${APP_EXE}"

  SetOutPath "$INSTDIR\resources"
  File /r "${PAYLOAD}\resources\*.*"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortcut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"
  CreateShortcut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}"

  WriteRegStr HKCU "Software\${APP_ID}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" {{ESTIMATED_SIZE_KB}}
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\${APP_EXE}"
  RMDir /r "$INSTDIR\resources"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$SMPROGRAMS\${APP_NAME}.lnk"
  Delete "$DESKTOP\${APP_NAME}.lnk"

  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\${APP_ID}"
SectionEnd
