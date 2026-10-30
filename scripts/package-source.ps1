$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $repositoryRoot 'dist'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$sourcePath = Join-Path $outputDirectory 'deadfrontier-overview-source.zip'
# Only reviewed tracked source categories; never recurse through the workspace.
$sourceFiles = @(git -C $repositoryRoot ls-files | Where-Object {
  $_ -match '^[^/]+\.(js|json|html|css|md|png)$' -or
  $_ -match '^(_locales|scripts|test|vendor/ocr)/' -or
  $_ -eq 'docs/integration.md'
})
if ($LASTEXITCODE -ne 0) { throw 'Unable to enumerate tracked sources.' }
$sourceFiles += @('README-SOURCE.md','scripts/package-source.ps1')
$sourceFiles = @($sourceFiles | Sort-Object -Unique)
Add-Type -AssemblyName System.IO.Compression
$sourceStream = [IO.File]::Open($sourcePath, [IO.FileMode]::Create)
$sourceZip = [IO.Compression.ZipArchive]::new($sourceStream, [IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($sourceFile in $sourceFiles) {
    $entry = $sourceZip.CreateEntry($sourceFile, [IO.Compression.CompressionLevel]::Optimal)
    $entryStream = $entry.Open()
    $inputStream = [IO.File]::OpenRead((Join-Path $repositoryRoot $sourceFile))
    try { $inputStream.CopyTo($entryStream) } finally { $inputStream.Dispose(); $entryStream.Dispose() }
  }
} finally { $sourceZip.Dispose(); $sourceStream.Dispose() }
Write-Output "Source package: $($sourceFiles.Count) reviewed files."
Write-Output $sourcePath
