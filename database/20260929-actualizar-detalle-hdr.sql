-- Compatible con la API SITMAS que ya envía DistanciaDesdeAnterior_Km.
-- NULL conserva la distancia para clientes antiguos que omiten el parámetro.
CREATE OR ALTER PROCEDURE dbo.sp_ActualizarDetalleHDR
    @Id_Detalle_HDR INT,
    @Id_HojaRuta INT,
    @Id_TipoMovimiento INT,
    @Id_RecursoMov INT,
    @Id_Origen INT,
    @Id_TipoMaterial INT,
    @HoraEstimada TIME(7),
    @Id_Estado INT,
    @Id_Ubicacion INT,
    @DistanciaDesdeAnterior_Km DECIMAL(8,2) = NULL
AS
BEGIN
    SET NOCOUNT OFF;
    UPDATE dbo.Detalle_Hoja_Ruta
    SET Id_HojaRuta = @Id_HojaRuta,
        Id_TipoMovimiento = @Id_TipoMovimiento,
        Id_RecursoMov = @Id_RecursoMov,
        Id_Origen = @Id_Origen,
        Id_TipoMaterial = @Id_TipoMaterial,
        HoraEstimada = @HoraEstimada,
        Id_Estado = @Id_Estado,
        Id_Ubicacion = @Id_Ubicacion,
        DistanciaDesdeAnterior_Km = COALESCE(@DistanciaDesdeAnterior_Km, DistanciaDesdeAnterior_Km)
    WHERE Id_Detalle_HDR = @Id_Detalle_HDR;
END
