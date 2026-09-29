param(
  [Parameter(Mandatory=$true)][string]$SitmasConfig,
  [string]$ApiBase = 'https://localhost:44325/api'
)
# Auditoría de solo lectura. Usa la conexión existente de SITMAS sin imprimirla.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Data
[xml]$config = Get-Content -LiteralPath $SitmasConfig
$connection = [System.Data.SqlClient.SqlConnection]::new(
  ($config.configuration.connectionStrings.add | Where-Object name -eq 'CadenaSITMAS').connectionString
)
$differences = [System.Collections.Generic.List[string]]::new()
try {
  $connection.Open()
  $command = $connection.CreateCommand()
  $command.CommandText = 'SELECT Id, HojaRutaFecha, Id_Vehiculo, Id_Chofer FROM dbo.Hoja_Ruta ORDER BY Id'
  $headers = [System.Data.DataTable]::new()
  $headers.Load($command.ExecuteReader())
  $command.CommandText = 'SELECT Id_Detalle, Numero_HojaRuta, Latitud, Longitud, Origen, HoraEstimadaFormateada, EstadoRecorrido FROM dbo.vw_Detalle_HojaRuta'
  $details = [System.Data.DataTable]::new()
  $details.Load($command.ExecuteReader())
  $routes = Invoke-RestMethod -Uri "$ApiBase/hojaruta" -TimeoutSec 20
  if (@($routes).Count -ne $headers.Rows.Count) { $differences.Add('Cantidad de hojas') }
  foreach ($row in $headers.Rows) {
    if (@($routes | Where-Object Id -eq $row.Id).Count -ne 1) { $differences.Add("Hoja ausente o repetida: $($row.Id)") }
    $apiRow = Invoke-RestMethod -Uri "$ApiBase/hojaruta/$($row.Id)" -TimeoutSec 20
    if ($row.Id -ne $apiRow.Id -or $row.Id_Vehiculo -ne $apiRow.Id_Vehiculo -or $row.Id_Chofer -ne $apiRow.Id_Chofer -or $row.HojaRutaFecha.Date -ne ([datetime]$apiRow.HojaRutaFecha).Date) {
      $differences.Add("Cabecera: $($row.Id)")
    }
  }
  $stopCount = 0
  $summary = @()
  foreach ($route in $routes) {
    # Invoke-RestMethod entrega la colección como un objeto; asignarla antes de enumerar.
    $response = Invoke-RestMethod -Uri "$ApiBase/detallehojaruta/hojaruta/$($route.Id)" -TimeoutSec 20
    $stops = @($response)
    $stopCount += $stops.Count
    $summary += [pscustomobject]@{ Hoja=$route.Id; Paradas=$stops.Count; ConGPS=@($stops | Where-Object { $null -ne $_.Latitud -and $null -ne $_.Longitud }).Count }
    $sqlRows = @($details.Rows | Where-Object Numero_HojaRuta -eq $route.Id)
    if ($sqlRows.Count -ne $stops.Count) { $differences.Add("Cantidad de paradas en hoja: $($route.Id)") }
    foreach ($stop in $stops) {
      $matches = @($sqlRows | Where-Object Id_Detalle -eq $stop.Id_Detalle_HDR)
      if ($matches.Count -ne 1) { $differences.Add("Parada ausente o repetida: $($stop.Id_Detalle_HDR)"); continue }
      $row = $matches[0]
      if ($row.Numero_HojaRuta -ne $stop.Id_HojaRuta -or [string]$row.Origen -ne [string]$stop.Origen -or [string]$row.HoraEstimadaFormateada -ne [string]$stop.HoraEstimadaFormateada -or [string]$row.EstadoRecorrido -ne [string]$stop.EstadoRecorrido) {
        $differences.Add("Datos de parada: $($stop.Id_Detalle_HDR)")
      }
      foreach ($field in @('Latitud','Longitud')) {
        if ($row[$field] -is [DBNull]) {
          if ($null -ne $stop.$field) { $differences.Add("$field de parada: $($stop.Id_Detalle_HDR)") }
        } elseif ($null -eq $stop.$field -or [decimal]$row[$field] -ne [decimal]$stop.$field) {
          $differences.Add("$field de parada: $($stop.Id_Detalle_HDR)")
        }
      }
    }
  }
  if ($stopCount -ne $details.Rows.Count) { $differences.Add('Total de paradas') }
  [pscustomobject]@{
    Base=$connection.Database; HojasSQL=$headers.Rows.Count; HojasAPI=@($routes).Count
    ParadasSQL=$details.Rows.Count; ParadasAPI=$stopCount; Diferencias=@($differences.ToArray()); PorHoja=$summary
  } | ConvertTo-Json -Depth 4
  if ($differences.Count) { exit 1 }
} finally { $connection.Dispose() }

