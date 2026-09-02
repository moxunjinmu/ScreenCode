$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$cargoHome = Join-Path $projectRoot '.tools\rust\cargo'
$rustupHome = Join-Path $projectRoot '.tools\rust\rustup'
$gstRoot = Join-Path $projectRoot '.tools\gstreamer\1.0\msvc_x86_64'
$cargo = Join-Path $cargoHome 'bin\cargo.exe'
$manifest = Join-Path $projectRoot 'native\gst-capture\Cargo.toml'
$targetExe = Join-Path $projectRoot 'native\gst-capture\target\release\screencode-gst-capture.exe'
$outputDir = Join-Path $projectRoot 'resources\native'

foreach ($required in @($cargo, $manifest, (Join-Path $gstRoot 'bin\gstreamer-1.0-0.dll'))) {
  if (-not (Test-Path -LiteralPath $required)) {
    throw "Missing native build dependency: $required"
  }
}

$env:CARGO_HOME = $cargoHome
$env:RUSTUP_HOME = $rustupHome
$env:PATH = "$(Join-Path $cargoHome 'bin');$(Join-Path $gstRoot 'bin');$env:PATH"
$env:PKG_CONFIG_PATH = Join-Path $gstRoot 'lib\pkgconfig'

& $cargo build --release --manifest-path $manifest
if ($LASTEXITCODE -ne 0) { throw 'Rust sidecar build failed' }

New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
Copy-Item -LiteralPath $targetExe -Destination (Join-Path $outputDir 'screencode-gst-capture.exe') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'native\THIRD_PARTY_NOTICES.md') -Destination $outputDir -Force
Write-Output "[native] sidecar: $(Join-Path $outputDir 'screencode-gst-capture.exe')"
