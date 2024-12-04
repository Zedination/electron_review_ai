!macro customInstall
  ; Add context menu when right-clicking on a directory
  SetRegView 64
  WriteRegStr HKCU "Software\\Classes\\Directory\\shell\\Open with DRAI" "" "Open with DRAI"
  WriteRegStr HKCU "Software\\Classes\\Directory\\shell\\Open with DRAI" "Icon" "$INSTDIR\\DRAI.exe"
  WriteRegStr HKCU "Software\\Classes\\Directory\\shell\\Open with DRAI\\command" "" '"$INSTDIR\\DRAI.exe" "%1"'

  ; Add context menu when right-clicking on the directory background
  SetRegView 64
  WriteRegStr HKCU "Software\\Classes\\Directory\\Background\\shell\\Open with DRAI" "" "Open with DRAI"
  WriteRegStr HKCU "Software\\Classes\\Directory\\Background\\shell\\Open with DRAI" "Icon" "$INSTDIR\\DRAI.exe"
  WriteRegStr HKCU "Software\\Classes\\Directory\\Background\\shell\\Open with DRAI\\command" "" '"$INSTDIR\\DRAI.exe" "%V"'
!macroend

!macro customUnInstall
  ; Remove context menu entries when uninstalling (Directory)
  DeleteRegKey HKCU "Software\\Classes\\Directory\\shell\\Open with DRAI\\command"
  DeleteRegKey HKCU "Software\\Classes\\Directory\\shell\\Open with DRAI"

  ; Remove context menu entries when uninstalling (Background)
  DeleteRegKey HKCU "Software\\Classes\\Directory\\Background\\shell\\Open with DRAI\\command"
  DeleteRegKey HKCU "Software\\Classes\\Directory\\Background\\shell\\Open with DRAI"
!macroend
