$ErrorActionPreference = 'Stop'

$package = Get-Content (Join-Path $PSScriptRoot '..\package.json') -Raw | ConvertFrom-Json
$installer = Join-Path $PSScriptRoot "..\download\Mayhempedia-$($package.version)-setup-x64.exe"

if (-not (Test-Path -LiteralPath $installer)) {
  throw "Signed release verification failed: installer was not found at $installer"
}

$signature = Get-AuthenticodeSignature -LiteralPath $installer
if ($signature.Status -ne 'Valid') {
  throw "Signed release verification failed: $($signature.Status) - $($signature.StatusMessage)"
}

if (-not $signature.SignerCertificate.Subject) {
  throw 'Signed release verification failed: the installer has no publisher certificate subject.'
}

Write-Host "Signed release verified: $($signature.SignerCertificate.Subject)"
