$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
# Reuse the reviewed file allowlist; retain the Firefox package separately.
& (Join-Path $PSScriptRoot 'package.ps1')
$firefoxArchive = Join-Path $repositoryRoot 'dist/deadfrontier-overview.zip'
$chromeArchive = Join-Path $repositoryRoot 'dist/deadfrontier-overview-chrome.zip'
$chromeManifest = Get-Content -LiteralPath (Join-Path $repositoryRoot 'manifest.json') -Raw | ConvertFrom-Json
$chromeManifest.PSObject.Properties.Remove('browser_specific_settings')
$chromeManifest.background.PSObject.Properties.Remove('scripts')
$manifestBytes = [Text.UTF8Encoding]::new($false).GetBytes(($chromeManifest | ConvertTo-Json -Depth 20))
Add-Type -AssemblyName System.IO.Compression.FileSystem
$inputArchive = [IO.Compression.ZipFile]::OpenRead($firefoxArchive)
$outputStream = [IO.File]::Open($chromeArchive, [IO.FileMode]::Create)
$outputArchive = [IO.Compression.ZipArchive]::new($outputStream, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($sourceEntry in $inputArchive.Entries) {
    $targetEntry = $outputArchive.CreateEntry($sourceEntry.FullName, [IO.Compression.CompressionLevel]::Optimal)
    $targetStream = $targetEntry.Open()
    try {
      if ($sourceEntry.FullName -eq 'manifest.json') { $targetStream.Write($manifestBytes, 0, $manifestBytes.Length) }
      else {
        $inputStream = $sourceEntry.Open()
        try { $inputStream.CopyTo($targetStream) } finally { $inputStream.Dispose() }
      }
    } finally { $targetStream.Dispose() }
  }
} finally { $inputArchive.Dispose(); $outputArchive.Dispose(); $outputStream.Dispose() }
$checksum = (Get-FileHash -LiteralPath $chromeArchive -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $repositoryRoot 'dist/CHROME-SHA256SUMS.txt'), "$checksum  deadfrontier-overview-chrome.zip`n")
Write-Output "Packaged Chrome manifest $($chromeManifest.version): service worker only; no Firefox-specific settings."
Write-Output $chromeArchive
