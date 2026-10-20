IF COL_LENGTH('dbo.Detalle_Hoja_Ruta', 'FechaPrevista') IS NULL
    ALTER TABLE dbo.Detalle_Hoja_Ruta ADD FechaPrevista DATE NULL;
GO
CREATE OR ALTER PROCEDURE dbo.sp_ListarDetallesPendientes
AS
BEGIN
    SET NOCOUNT ON;
    SELECT v.*, d.FechaPrevista
    FROM dbo.vw_Detalle_HojaRuta v
    JOIN dbo.Detalle_Hoja_Ruta d ON d.Id_Detalle_HDR = v.Id_Detalle
    WHERE v.Numero_HojaRuta IS NULL OR v.Numero_HojaRuta = 0;
END;
GO
CREATE OR ALTER PROCEDURE dbo.sp_InsertarDetalleHDR
    @Id_HojaRuta INT,
    @Id_TipoMovimiento INT,
    @Id_RecursoMov INT = NULL,
    @Id_Origen INT = NULL,
    @Id_TipoMaterial INT = NULL,
    @HoraEstimada TIME(7) = NULL,
    @Id_Estado INT = NULL,
    @Id_Ubicacion INT = NULL,
    @DistanciaDesdeAnterior_Km DECIMAL(8,2) = 0,
    @FechaPrevista DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.Detalle_Hoja_Ruta
      (Id_HojaRuta, Id_TipoMovimiento, Id_RecursoMov, Id_Origen, Id_TipoMaterial,
       HoraEstimada, Id_Estado, Id_Ubicacion, DistanciaDesdeAnterior_Km, FechaPrevista)
    VALUES
      (@Id_HojaRuta, @Id_TipoMovimiento, @Id_RecursoMov, @Id_Origen, @Id_TipoMaterial,
       @HoraEstimada, @Id_Estado, @Id_Ubicacion, @DistanciaDesdeAnterior_Km, @FechaPrevista);
    SELECT SCOPE_IDENTITY() AS IdDetalleGenerado;
END;
