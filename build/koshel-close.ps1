# Помощник установщика Windows (вызывается из build/installer.nsh).
#
#   -Mode close — закрыть всё, что запущено из папки программы (под любым
#                 именем) или называется как программа; ждать до 10 секунд.
#                 Выход: 0 — ничего не осталось, 1 — что-то не закрылось.
#   -Mode files — проверить, что файлы старой версии никто не держит
#                 (антивирус, поиск Windows и т. п.); ждать до 15 секунд.
#                 Выход: 0 — свободны, 2 — какие-то заняты.
#
# Всё, что увидели, дописывается в журнал (-Log) — по нему видно, какой файл
# и какой процесс мешали установке.
param(
  [string]$Dir,
  [string]$Name,
  [int]$Me = 0,
  [string]$Mode = 'close',
  [string]$Log = "$env:TEMP\koshel-install.log"
)

function Write-Log([string]$text) {
  try { Add-Content -LiteralPath $Log -Value ("{0:yyyy-MM-dd HH:mm:ss}  [{1}] {2}" -f (Get-Date), $Mode, $text) -Encoding UTF8 } catch {}
}

$d = $Dir.TrimEnd('\') + '\'

function Get-Leftovers {
  @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
      $_.ProcessId -ne $Me -and ($_.Name -eq $Name -or ($_.ExecutablePath -and $_.ExecutablePath.StartsWith($d, [StringComparison]::OrdinalIgnoreCase)))
    })
}

if ($Mode -eq 'close') {
  for ($i = 0; $i -lt 20; $i++) {
    $p = Get-Leftovers
    if ($p.Count -eq 0) {
      if ($i -gt 0) { Write-Log 'все процессы закрыты' }
      exit 0
    }
    if ($i -eq 0) { Write-Log ('закрываем: ' + (($p | ForEach-Object { '{0} #{1} {2}' -f $_.Name, $_.ProcessId, $_.ExecutablePath }) -join '; ')) }
    $p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
  }
  Write-Log ('не закрылись: ' + ((Get-Leftovers | ForEach-Object { '{0} #{1}' -f $_.Name, $_.ProcessId }) -join '; '))
  exit 1
}

if ($Mode -eq 'files') {
  if (-not (Test-Path -LiteralPath $d)) { exit 0 }
  $busy = @()
  for ($i = 0; $i -lt 30; $i++) {
    $busy = @(Get-ChildItem -LiteralPath $d -Recurse -File -Force -ErrorAction SilentlyContinue | Where-Object {
        try { [IO.File]::Open($_.FullName, 'Open', 'ReadWrite', 'None').Close(); $false } catch { $true }
      } | ForEach-Object { $_.FullName })
    if ($busy.Count -eq 0) {
      if ($i -gt 0) { Write-Log 'файлы освободились' }
      exit 0
    }
    if ($i -eq 0) { Write-Log ('заняты: ' + ($busy -join '; ')) }
    Start-Sleep -Milliseconds 500
  }
  Write-Log ('так и остались заняты: ' + ($busy -join '; '))
  exit 2
}
