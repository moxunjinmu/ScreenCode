$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$gstRoot = Join-Path $projectRoot '.tools\gstreamer\1.0\msvc_x86_64'
$runtimeRoot = Join-Path $projectRoot 'resources\native\gstreamer'
$binSource = Join-Path $gstRoot 'bin'
$pluginSource = Join-Path $gstRoot 'lib\gstreamer-1.0'
$inspect = Join-Path $binSource 'gst-inspect-1.0.exe'
$expectedVersion = '1.28.6'
$expectedInstallerHash = '059251444d1267b486eba390b18d25fed87e10315e72f757ec6c7e912fa746b5'
$installer = Join-Path $projectRoot ".tools\installers\gstreamer-1.0-msvc-x86_64-$expectedVersion.exe"

foreach ($required in @($inspect, $installer)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Missing GStreamer file: $required" }
}
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$installerStream = [System.IO.File]::OpenRead($installer)
try {
  $actualInstallerHash = ([System.BitConverter]::ToString($sha256.ComputeHash($installerStream))).Replace('-', '').ToLowerInvariant()
} finally {
  $installerStream.Dispose()
  $sha256.Dispose()
}
if ($actualInstallerHash -ne $expectedInstallerHash) { throw 'GStreamer installer SHA-256 mismatch' }

$targetBin = Join-Path $runtimeRoot 'bin'
$targetPlugins = Join-Path $runtimeRoot 'lib\gstreamer-1.0'
$targetLibexec = Join-Path $runtimeRoot 'libexec\gstreamer-1.0'
New-Item -ItemType Directory -Path $targetBin,$targetPlugins,$targetLibexec -Force | Out-Null

# Keep the complete bin directory to preserve transitive DLLs; trim only the plugin directory.
Get-ChildItem -LiteralPath $binSource -File | Copy-Item -Destination $targetBin -Force
Get-ChildItem -LiteralPath (Join-Path $gstRoot 'libexec\gstreamer-1.0') -File |
  Copy-Item -Destination $targetLibexec -Force

$elements = @(
  'mfvideosrc', 'mfh264enc', 'amfh264enc', 'd3d12h264enc', 'd3d11convert',
  'appsink', 'videoconvert', 'videorate', 'jpegdec', 'pngenc', 'vp8enc',
  'webrtcsink', 'webrtcbin', 'rtpbin', 'rtph264pay', 'rtpvp8pay', 'h264parse',
  'nicesrc', 'dtlssrtpenc', 'srtpenc', 'errorignore', 'identity', 'queue', 'tee'
)
$pluginFiles = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($element in $elements) {
  $inspection = (& $inspect $element | Out-String)
  if ($LASTEXITCODE -ne 0) {
    if ($element -in @('amfh264enc', 'mfh264enc', 'd3d12h264enc')) { continue }
    throw "Missing required GStreamer element: $element"
  }
  $match = [regex]::Match($inspection, '(?m)^\s*Filename\s+(.+\.dll)\s*$')
  if (-not $match.Success) { throw "Cannot resolve plugin path for: $element" }
  [void]$pluginFiles.Add($match.Groups[1].Value.Trim())
}
foreach ($plugin in $pluginFiles) {
  Copy-Item -LiteralPath $plugin -Destination $targetPlugins -Force
}

$env:PATH = "$targetBin;$env:PATH"
$env:GST_PLUGIN_SYSTEM_PATH_1_0 = $targetPlugins
$env:GST_PLUGIN_PATH_1_0 = ''
$env:GST_REGISTRY_1_0 = Join-Path $runtimeRoot 'registry-build.bin'
foreach ($element in @(
  'mfvideosrc', 'appsink', 'webrtcsink', 'videorate', 'errorignore',
  'rtpbin', 'h264parse', 'pngenc', 'vp8enc'
)) {
  & (Join-Path $targetBin 'gst-inspect-1.0.exe') $element *> $null
  if ($LASTEXITCODE -ne 0) { throw "Private runtime self-check failed: $element" }
}

$manifestFiles = Get-ChildItem -LiteralPath $runtimeRoot -File -Recurse | Where-Object { $_.Name -ne 'runtime-manifest.json' } | ForEach-Object {
  $relativePath = $_.FullName.Substring($runtimeRoot.Length).TrimStart([char]'\').Replace('\', '/')
  [ordered]@{
    path = $relativePath
    size = $_.Length
    sha256 = & {
      $fileHash = [System.Security.Cryptography.SHA256]::Create()
      $fileStream = [System.IO.File]::OpenRead($_.FullName)
      try {
        ([System.BitConverter]::ToString($fileHash.ComputeHash($fileStream))).Replace('-', '').ToLowerInvariant()
      } finally {
        $fileStream.Dispose()
        $fileHash.Dispose()
      }
    }
  }
}
$manifest = [ordered]@{
  gstreamerVersion = $expectedVersion
  installerSha256 = $expectedInstallerHash
  generatedAt = (Get-Date).ToUniversalTime().ToString('o')
  files = @($manifestFiles)
}
[IO.File]::WriteAllText(
  (Join-Path $runtimeRoot 'runtime-manifest.json'),
  ($manifest | ConvertTo-Json -Depth 4),
  [Text.UTF8Encoding]::new($false)
)
Write-Output "[native] GStreamer runtime: $runtimeRoot"
