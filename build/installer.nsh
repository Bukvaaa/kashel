; Дополнение к установщику Windows (electron-builder, nsis.include).
;
; Кошель по умолчанию прячется в трей и продолжает работать после «крестика».
; Пока он работает, его файлы заняты, и установщик не может их заменить:
; в 1.1.1 он зависал на «Копирование файлов», в 1.1.2 и 1.1.3 говорил «Не
; удалось закрыть Кошель», хотя окна программы давно не было.
;
; Порядок:
;   1. taskkill по имени файла — со всеми дочерними процессами Electron;
;   2. koshel-close.ps1 -Mode close: всё, что запущено из папки программы
;      (под любым именем) или называется как программа, — закрыть и ждать;
;      не вышло — то же с правами администратора (Windows спросит), не вышло
;      и так — понятное сообщение с «Повтор»;
;   3. (только установщик) koshel-close.ps1 -Mode files: файлы старой версии
;      никто не держит? Старая версия удаляется «атомарно» — каждый файл
;      переносится во временную папку, и если хоть один занят антивирусом или
;      поиском Windows, удаление проваливается, а установщик пять раз
;      повторяет и показывает то самое «Не удалось закрыть Кошель». Поэтому,
;      если через 15 секунд файлы всё ещё заняты, старый деинсталлятор не
;      зовём (стираем ссылку на него в реестре), и новые файлы просто ложатся
;      поверх: запись в файл антивирус обычно не запрещает, а перенос — да.
;      Ссылку на деинсталлятор установщик потом пишет заново.
;
; Что происходило, пишется в %TEMP%\koshel-install.log.
; Данные не страдают: они в «Документах», и программа пишет их сразу.
; Сам установщик под закрытие не попадает: имя другое, лежит не в папке
; программы, а свой номер процесса исключён.
!macro customCheckAppRunning
  Push $0
  Push $8
  Push $9

  InitPluginsDir
  File /oname=$PLUGINSDIR\koshel-close.ps1 "${BUILD_RESOURCES_DIR}\koshel-close.ps1"

  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
  Pop $0

  System::Call 'kernel32::GetCurrentProcessId() i .r9'
  StrCpy $8 `-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$PLUGINSDIR\koshel-close.ps1" -Dir "$INSTDIR" -Name "${APP_EXECUTABLE_FILENAME}" -Me $9`

  ${Do}
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" $8 -Mode close`
    Pop $0
    ${If} $0 == "0"
      ${Break}
    ${EndIf}

    DetailPrint `Кошель не закрывается обычным способом — пробуем с правами администратора.`
    ExecShellWait "runas" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" `-WindowStyle Hidden $8 -Mode close` SW_HIDE
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" $8 -Mode close`
    Pop $0
    ${If} $0 == "0"
      ${Break}
    ${EndIf}

    ${If} ${Cmd} `MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Кошель всё ещё работает в фоне и не закрывается.$\n$\nЗакройте его в Диспетчере задач (Ctrl+Shift+Esc → «Кошель» → «Снять задачу») или перезагрузите компьютер, затем нажмите «Повтор».$\n$\nKoshel is still running in the background. Close it in Task Manager or restart the computer, then press Retry." /SD IDCANCEL IDCANCEL`
      Quit
    ${EndIf}
  ${Loop}

  !ifndef __UNINSTALL__
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" $8 -Mode files`
    Pop $0
    ${If} $0 == "2"
      DetailPrint `Файлы прежней версии заняты другой программой — ставим поверх, без удаления.`
      DeleteRegValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" UninstallString
      !ifdef UNINSTALL_REGISTRY_KEY_2
        DeleteRegValue SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY_2}" UninstallString
      !endif
    ${EndIf}
  !endif

  ; Windows отпускает файлы закрытой программы не мгновенно.
  Sleep 1000

  Pop $9
  Pop $8
  Pop $0
!macroend
