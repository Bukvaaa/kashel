; Дополнение к установщику Windows (electron-builder, nsis.include).
;
; Кошель по умолчанию прячется в трей и продолжает работать после «крестика».
; Пока он работает, его файлы заняты, и установщик не может их заменить:
; в 1.1.1 он зависал на «Копирование файлов», а в 1.1.2 говорил «Не удалось
; закрыть Кошель», хотя окна программы давно не было.
;
; Поэтому установщик закрывает программу сам и проверяет, что она закрылась:
;   1. taskkill по имени файла — со всеми дочерними процессами Electron;
;   2. PowerShell: всё, что запущено из папки программы (под любым именем) или
;      называется как программа, — закрыть и ждать до 10 секунд, пока
;      Windows отпустит файлы;
;   3. если что-то осталось — значит, процесс запущен от администратора или
;      завис: тот же шаг ещё раз с правами администратора (Windows спросит
;      разрешение);
;   4. если и это не помогло — понятное сообщение: «Повторить» или
;      перезагрузить компьютер. Файлы к этому моменту ещё не тронуты, так что
;      «Отмена» оставляет старую версию рабочей.
; Данные при этом не страдают: они в «Документах», и программа пишет их сразу
; при изменении. Сам установщик («Кошель 1.1.x установщик.exe») под закрытие
; не попадает: имя другое, лежит не в папке программы, а свой номер процесса
; исключён.
!macro customCheckAppRunning
  Push $0
  Push $8
  Push $9

  nsExec::Exec `"$SYSDIR\taskkill.exe" /F /T /IM "${APP_EXECUTABLE_FILENAME}"`
  Pop $0

  System::Call 'kernel32::GetCurrentProcessId() i .r9'
  ; Код выхода: 0 — ничего не осталось, 1 — остались процессы.
  StrCpy $8 `$$d='$INSTDIR'.TrimEnd('\')+'\'; $$n='${APP_EXECUTABLE_FILENAME}'; function L { @(Get-CimInstance Win32_Process | ? { $$_.ProcessId -ne $9 -and ($$_.Name -eq $$n -or ($$_.ExecutablePath -and $$_.ExecutablePath.StartsWith($$d, 'OrdinalIgnoreCase'))) }) }; for ($$i = 0; $$i -lt 20; $$i++) { $$p = L; if ($$p.Count -eq 0) { exit 0 }; $$p | % { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 500 }; exit 1`

  ${Do}
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$8"`
    Pop $0
    ${If} $0 == "0"
      ${Break}
    ${EndIf}

    DetailPrint `Кошель не закрывается обычным способом — пробуем с правами администратора.`
    ExecShellWait "runas" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" `-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$8"` SW_HIDE
    nsExec::Exec `"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$8"`
    Pop $0
    ${If} $0 == "0"
      ${Break}
    ${EndIf}

    ${If} ${Cmd} `MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Кошель всё ещё работает в фоне и не закрывается.$\n$\nЗакройте его в Диспетчере задач (Ctrl+Shift+Esc → «Кошель» → «Снять задачу») или перезагрузите компьютер, затем нажмите «Повтор».$\n$\nKoshel is still running in the background. Close it in Task Manager or restart the computer, then press Retry." /SD IDCANCEL IDCANCEL`
      Quit
    ${EndIf}
  ${Loop}

  ; Windows отпускает файлы закрытой программы не мгновенно.
  Sleep 1000

  Pop $9
  Pop $8
  Pop $0
!macroend
