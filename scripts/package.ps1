$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $repositoryRoot 'manifest.json') -Raw | ConvertFrom-Json
if ($env:GITHUB_REF_TYPE -eq 'tag' -and $env:GITHUB_REF_NAME -ne "v$($manifest.version)") { throw 'Release tag must match the manifest version.' }
$outputDirectory = Join-Path $repositoryRoot 'dist'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$archivePath = Join-Path $outputDirectory 'deadfrontier-overview.zip'

# Explicit allowlist: no profiles, screenshots, test fixtures or local secrets.
$packageFiles = @(
  'manifest.json', 'background.js', 'bank-request.js', 'catalog.js', 'content.js',
  'core.js', 'dashboard.html', 'dashboard.js', 'experience.js', 'i18n.js', 'icon.png', 'capture-controller.js', 'ocr-parser.js',
  'page-observer.js', 'server-sync.js', 'styles.css', 'xp-protocol.js', 'xp-request.js',
  '_locales/en/messages.json', '_locales/pt/messages.json', 'INSTALL.md'
)
$ocrAssets = @('tesseract.esm.min.js','worker.min.js','eng.traineddata.gz','TESSERACT-LICENSE','CORE-LICENSE','bundle.LICENSE.txt','worker.LICENSE.txt','README.md')
foreach ($ocrAsset in $ocrAssets) { $packageFiles += "vendor/ocr/$ocrAsset" }
foreach ($ocrCore in @(Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'vendor/ocr') -Filter 'tesseract-core*.wasm.js' -File)) { $packageFiles += "vendor/ocr/$($ocrCore.Name)" }
Add-Type -AssemblyName System.IO.Compression
$archiveStream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
$archive = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($packageFile in $packageFiles) {
    $sourcePath = Join-Path $repositoryRoot $packageFile
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) { throw "Package file missing: $packageFile" }
    $entry = $archive.CreateEntry($packageFile, [System.IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $sourceStream = [System.IO.File]::OpenRead($sourcePath)
    try { $sourceStream.CopyTo($entryStream) } finally { $sourceStream.Dispose(); $entryStream.Dispose() }
  }
} finally { $archive.Dispose(); $archiveStream.Dispose() }
$checksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[System.IO.File]::WriteAllText((Join-Path $outputDirectory 'SHA256SUMS.txt'), "$checksum  deadfrontier-overview.zip`n")
Write-Output "Packaged DeadFrontier Overview $($manifest.version): $($packageFiles.Count) reviewed files."
Write-Output $archivePath
