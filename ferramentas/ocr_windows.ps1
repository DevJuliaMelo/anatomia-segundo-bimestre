param([string]$dir, [string]$out)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }
$langs = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages | % { $_.LanguageTag }
Write-Host "langs: $langs"
$lang = [Windows.Globalization.Language]::new(($langs | ? { $_ -like 'pt*' } | select -first 1))
if (-not $lang.LanguageTag) { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages() } else { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang) }
$res = @{}
Get-ChildItem $dir -Filter *.png | % {
  $f = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($_.FullName)) ([Windows.Storage.StorageFile])
  $s = Await ($f.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $dec = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($s)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bmp = Await ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  $r = Await ($engine.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
  $lines = @()
  foreach ($l in $r.Lines) { $ws = @(); foreach ($w in $l.Words) { $b=$w.BoundingRect; $ws += ,@($w.Text,[int]$b.X,[int]$b.Y,[int]$b.Width,[int]$b.Height) }; $lines += ,@{t=$l.Text; w=$ws} }
  $res[$_.BaseName] = $lines
  $s.Dispose()
}
$res | ConvertTo-Json -Depth 6 -Compress | Out-File -Encoding utf8 $out
