$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$applicationDirectory = [IO.Path]::GetFullPath((Join-Path $repositoryRoot 'dist/windows/DeadFrontier Overview-win32-x64'))
$workspacePrefix = [IO.Path]::GetFullPath($repositoryRoot).TrimEnd('\') + '\'
if (-not $applicationDirectory.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected desktop artifact path.' }
if (-not (Test-Path -LiteralPath (Join-Path $applicationDirectory 'DeadFrontier Overview.exe'))) { throw 'Build the desktop app first: cd desktop; npm run package' }
$privateArtifactFiles = @(Get-ChildItem -LiteralPath $applicationDirectory -Recurse -File | Where-Object { $_.Extension -in @('.sqlite','.db','.har','.log') -or $_.FullName -match '[\\/]\.tmp[\\/]' })
if ($privateArtifactFiles.Count) { throw 'Unexpected runtime data in portable package.' }
$archivePath = Join-Path $repositoryRoot 'dist/deadfrontier-overview-windows-0.1.0.zip'
Compress-Archive -LiteralPath $applicationDirectory -DestinationPath $archivePath -CompressionLevel Optimal -Force
$checksum = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $repositoryRoot 'dist/WINDOWS-SHA256SUMS.txt'), "$checksum  deadfrontier-overview-windows-0.1.0.zip`n")
Write-Output $archivePath
