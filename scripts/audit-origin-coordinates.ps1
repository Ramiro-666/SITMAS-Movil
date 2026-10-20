param([Parameter(Mandatory=$true)][string]$SitmasConfig)
$ErrorActionPreference='Stop'
[xml]$config=Get-Content -LiteralPath $SitmasConfig
$c=[System.Data.SqlClient.SqlConnection]::new(($config.configuration.connectionStrings.add | Where-Object name -eq 'CadenaSITMAS').connectionString)
try {
$c.Open(); $cmd=$c.CreateCommand()
$cmd.CommandText='SELECT o.IdOrigen,o.EmpresaInstitucion,o.Id_Ubicacion,u.Latitud,u.Longitud FROM dbo.Origen o LEFT JOIN dbo.Ubicacion_Geografica u ON u.IdUbicacion=o.Id_Ubicacion ORDER BY o.IdOrigen'
$t=[System.Data.DataTable]::new(); $t.Load($cmd.ExecuteReader())
$api=Invoke-RestMethod https://localhost:44325/api/origen
$report=@('# Auditoría de coordenadas de orígenes SITMAS','',('Fecha: '+(Get-Date -Format yyyy-MM-dd)),'Fuente: SQL Gestion_SITMAS, tablas Origen y Ubicacion_Geografica; cotejo con GET /api/origen.','','| ID | Origen | Latitud | Longitud | Estado |','|---|---|---|---|---|')
$missing=0; $differences=0
foreach($r in $t.Rows){
 $matches=@($api | Where-Object IdOrigen -eq $r.IdOrigen)
 if($matches.Count -ne 1){$differences++}else{
  foreach($field in @('EmpresaInstitucion','Id_Ubicacion','Latitud','Longitud')){
   if($r[$field] -is [DBNull]){if($null -ne $matches[0].$field){$differences++}}
   elseif([string]$r[$field] -ne [string]$matches[0].$field){$differences++}
  }
 }
 $state='Con GPS'
 if($r.Latitud -is [DBNull] -or $r.Longitud -is [DBNull]){$state='Sin coordenadas';$missing++}
 elseif([math]::Abs($r.Latitud) -gt 90 -or [math]::Abs($r.Longitud) -gt 180){$state='Coordenadas inválidas'}
 $report += "| $($r.IdOrigen) | $($r.EmpresaInstitucion) | $($r.Latitud) | $($r.Longitud) | $state |"
}
if(@($api).Count -ne $t.Rows.Count){$differences++}
$report += @('',"Total: $($t.Rows.Count). Sin coordenadas: $missing. Diferencias SQL/API: $differences.",'','No se asignaron coordenadas por aproximación ni se modificaron orígenes. Coordenadas existentes verificadas contra SQL; no se certificó su ubicación física en terreno.')
$report | Set-Content (Join-Path $PSScriptRoot '../docs/auditoria-coordenadas-origenes.md')
Write-Output "Orígenes: $($t.Rows.Count); sin coordenadas: $missing; diferencias SQL/API: $differences"
if($differences){throw 'SQL y API difieren.'}
}finally{$c.Dispose()}
