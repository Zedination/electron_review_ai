!macro customInstall
  ; Thêm vào Context Menu khi chuột phải vào thư mục
  WriteRegStr HKCR "Directory\shell\Open with DRAI" '' "Open with DRAI"
  WriteRegStr HKCR "Directory\shell\Open with DRAI\command" '' '"$INSTDIR\\DRAI.exe" "%1"'

  ; Thêm vào Context Menu khi chuột phải vào nền thư mục
  WriteRegStr HKCR "Directory\Background\shell\Open with DRAI" '' "Open with DRAI"
  WriteRegStr HKCR "Directory\Background\shell\Open with DRAI\command" '' '"$INSTDIR\\DRAI.exe" "%V"'
!macroend

!macro customUnInstall
  ; Xóa mục Context Menu khi gỡ cài đặt (Directory)
  DeleteRegKey HKCR "Directory\shell\Open with DRAI\command"
  DeleteRegKey HKCR "Directory\shell\Open with DRAI"

  ; Xóa mục Context Menu khi gỡ cài đặt (Background)
  DeleteRegKey HKCR "Directory\Background\shell\Open with DRAI\command"
  DeleteRegKey HKCR "Directory\Background\shell\Open with DRAI"
!macroend
