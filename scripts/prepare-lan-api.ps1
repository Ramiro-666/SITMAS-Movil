param([Parameter(Mandatory)][string]$LanIp)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot
$ip = [System.Net.IPAddress]::Parse($LanIp)
if ($ip.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork -or
    !($LanIp -match '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)')) {
    throw 'Usá la IPv4 privada de esta PC.'
}
$folder = Join-Path $projectRoot '.local/lan-api'
if (Test-Path (Join-Path $folder 'server.key')) { throw 'Ya hay un certificado. Conservá sus archivos para que la APK siga confiando en él.' }
$null = New-Item -ItemType Directory -Force -Path $folder
Push-Location $projectRoot
try {
    @'
const tls = require('node:tls'), fs = require('node:fs');
let saved = false;
// Confianza inicial en el certificado de IIS local, sin desactivar TLS en el puente.
const socket = tls.connect({host:'localhost', port:44325, rejectUnauthorized:false}, () => {
  const cert = socket.getPeerCertificate();
  if (cert.subject.CN !== 'localhost') { socket.destroy(new Error('Certificado de IIS inesperado')); return; }
  fs.writeFileSync('.local/lan-api/upstream.crt', '-----BEGIN CERTIFICATE-----\n' + cert.raw.toString('base64').match(/.{1,64}/g).join('\n') + '\n-----END CERTIFICATE-----\n');
  saved = true; socket.destroy();
});
socket.setTimeout(6000, () => socket.destroy(new Error('Iniciá la API de SITMAS antes de preparar el puente.')));
socket.on('error', e => { if (!saved) { console.error(e.message); process.exitCode = 1; } });
'@ | node
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo obtener el certificado de la API local.' }
} finally { Pop-Location }
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$hash = [System.Security.Cryptography.HashAlgorithmName]::SHA256
$padding = [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=SITMAS LAN Pilot', $rsa, $hash, $padding)
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true, $false, 0, $true))
$request.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyCertSign, $true))
$ca = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-5), [DateTimeOffset]::UtcNow.AddDays(30))
$serverRsa = [System.Security.Cryptography.RSA]::Create(2048)
$serverRequest = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new("CN=$LanIp", $serverRsa, $hash, $padding)
$san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddIpAddress($ip)
$serverRequest.CertificateExtensions.Add($san.Build())
$serverRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true))
$serverRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment, $true))
$usages = [System.Security.Cryptography.OidCollection]::new()
$null = $usages.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
$serverRequest.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($usages, $false))
$serial = [byte[]]::new(16)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($serial)
$server = $serverRequest.Create($ca, [DateTimeOffset]::UtcNow.AddMinutes(-4), [DateTimeOffset]::UtcNow.AddDays(29), $serial)
[System.IO.File]::WriteAllText((Join-Path $folder 'server.crt'), $server.ExportCertificatePem())
[System.IO.File]::WriteAllText((Join-Path $folder 'server.key'), $serverRsa.ExportPkcs8PrivateKeyPem())
$publicFolder = Join-Path $projectRoot 'assets/certificates'
$null = New-Item -ItemType Directory -Force -Path $publicFolder
[System.IO.File]::WriteAllText((Join-Path $publicFolder 'sitmas-lan-ca.pem'), $ca.ExportCertificatePem())
# La clave de la CA no se guarda: no se emitirán otros certificados con ella.
$ca.Dispose(); $server.Dispose(); $rsa.Dispose(); $serverRsa.Dispose()
Write-Output "Certificado de piloto preparado para $LanIp (29 días). No se instaló en Windows."
