/** Cliente de la API SITMAS. Nunca conecta la aplicación directamente a SQL Server. */
const configuredBase =
  process.env.EXPO_PUBLIC_SITMAS_API_URL ?? 'https://localhost:44325/api';
const baseUrl = configuredBase.replace(/\/$/, '');

export type Session = {
  idUsuario: number;
  nombre: string;
  rol: string;
  permisos?: unknown[];
};
export type Vehiculo = {
  Id: number;
  Patente: string;
  Id_Modelo: number;
  Id_Tipo: number;
};
export type HojaRuta = {
  Id: number;
  FechaFormateada?: string;
  Vehiculo?: string;
  ChoferNombreCompleto?: string;
  Id_Vehiculo?: number;
  Id_Chofer?: number;
  HojaRutaFecha?: string;
};
export type PesoBruto = {
  Categoria: string;
  SubtipoMaterial: string;
  TotalPesoBrutoKg: number;
  CantidadPesadas: number;
};
export type Rendimiento = {
  Categoria: string;
  SubtipoMaterial: string;
  TotalPesoBrutoKg: number;
  TotalPesoUtilKg: number;
  TotalDescarteKg: number;
  PorcentajeRecuperacion: number;
};
export type StockNeto = {
  Categoria: string;
  SubtipoMaterial: string;
  StockDisponibleKg: number;
};
export type Odometro = {
  IdRegistroOdomet: number;
  IdVehiculo: number;
  Patente?: string;
  FechaRegOdomFormateada?: string;
  InicioOdom: number;
  FinalOdom: number;
  KmRecorridosDia?: number;
};
export type Marca = { Id: number; MarcaVehiculo: string };
export type Modelo = { Id: number; ModeloVehiculo: string; Id_Marca: number };
export type TipoVehiculo = {
  Id?: number;
  id_Tp_Vehiculo?: number;
  Tp_Vehiculo?: string;
  TipoVehiculo?: string;
};
export type Chofer = { Id: number; Nombre?: string; Apellido?: string };
export type Ubicacion = {
  IdUbicacion: number;
  Descripcion: string;
  Latitud: number;
  Longitud: number;
};
export type Parada = {
  Id_Detalle_HDR: number;
  Id_HojaRuta: number;
  Id_TipoMovimiento: number;
  Id_RecursoMov: number;
  Id_Origen: number;
  Id_TipoMaterial: number;
  Id_Estado: number;
  HoraEstimada?: string;
  HoraEstimadaFormateada?: string;
  TipoMovimiento?: string;
  RecursoMovilizado?: string;
  Origen?: string;
  TipoMaterial?: string;
  EstadoRecorrido?: string;
  Id_Ubicacion?: number | null;
  Latitud?: number | null;
  Longitud?: number | null;
  DistanciaDesdeAnterior_Km?: number;
};
export type CatalogItem = Record<string, string | number | undefined>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):8097(?:\/|$)/i.test(baseUrl)
  ) {
    throw new Error(
      'La demo fue retirada. Configurá la URL de la API real de SITMAS y reiniciá Expo.',
    );
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (init?.signal?.aborted) controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 20_000);
  try {
    const response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    const body = await response.text();
    let data: unknown = body;
    try {
      data = body ? JSON.parse(body) : undefined;
    } catch {
      /* respuesta de texto */
    }
    if (!response.ok)
      throw new ApiError(
        response.status,
        typeof data === 'object' && data
          ? JSON.stringify(data)
          : body || `Error ${response.status}`,
      );
    return data as T;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', abort);
  }
}

export const sitmasApi = {
  ubicaciones: (signal?: AbortSignal) =>
    request<Ubicacion[]>('ubicaciongeografica', { signal }),
  crearUbicacion: (location: Omit<Ubicacion, 'IdUbicacion'>) =>
    request<{ IdUbicacionGenerado: number }>('ubicaciongeografica', {
      method: 'POST',
      body: JSON.stringify({ IdUbicacion: 0, ...location }),
    }),
  login: (Usuario: string, Password: string) =>
    request<Session>('Usuario/Login', {
      method: 'POST',
      body: JSON.stringify({ Usuario, Password }),
    }),
  vehiculos: (signal?: AbortSignal) =>
    request<Vehiculo[]>('Vehiculo/ListarTodo', { signal }),
  guardarVehiculo: (
    data: Pick<Vehiculo, 'Patente' | 'Id_Modelo' | 'Id_Tipo'>,
    id?: number,
  ) =>
    request<void>(id ? `Vehiculo/Modificar/${id}` : 'Vehiculo/Insertar', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  borrarVehiculo: (id: number) =>
    request<void>(`Vehiculo/Borrar/${id}`, { method: 'POST' }),
  tiposVehiculo: (signal?: AbortSignal) =>
    request<TipoVehiculo[]>('Tp_Vehiculo/ListarTodo', { signal }),
  guardarTipoVehiculo: (nombre: string, id?: number) =>
    request<void>(id ? `Tp_Vehiculo/Modificar/${id}` : 'Tp_Vehiculo/Insertar', {
      method: 'POST',
      body: JSON.stringify({ TipoVehiculo: nombre }),
    }),
  borrarTipoVehiculo: (id: number) =>
    request<void>(`Tp_Vehiculo/Borrar/${id}`, { method: 'POST' }),
  marcas: (signal?: AbortSignal) =>
    request<Marca[]>('MarcaVeh/ListarTodo', { signal }),
  modelos: (signal?: AbortSignal) =>
    request<Modelo[]>('ModeloVeh/ListarTodo', { signal }),
  guardarMarca: (nombre: string, id?: number) =>
    request<void>(id ? `MarcaVeh/Modificar/${id}` : 'MarcaVeh/Insertar', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ MarcaVehiculo: nombre }),
    }),
  borrarMarca: (id: number) =>
    request<void>(`MarcaVeh/Borrar/${id}`, { method: 'DELETE' }),
  guardarModelo: (nombre: string, idMarca: number, id?: number) =>
    request<void>(id ? `ModeloVeh/Modificar/${id}` : 'ModeloVeh/Insertar', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify({ ModeloVehiculo: nombre, Id_Marca: idMarca }),
    }),
  borrarModelo: (id: number) =>
    request<void>(`ModeloVeh/Borrar/${id}`, { method: 'DELETE' }),
  hojasRuta: (signal?: AbortSignal) =>
    request<HojaRuta[]>('hojaruta', { signal }),
  hojaRuta: (id: number, signal?: AbortSignal) =>
    request<HojaRuta>(`hojaruta/${id}`, { signal }),
  choferes: (signal?: AbortSignal) =>
    request<Chofer[]>('Empleado/ListarChoferes', { signal }),
  crearHojaRuta: (data: {
    HojaRutaFecha: string;
    Id_Vehiculo: number;
    Id_Chofer: number;
  }) =>
    request<{ IdGenerado: number }>('hojaruta', {
      method: 'POST',
      body: JSON.stringify({ Id: 0, ...data }),
    }),
  actualizarHojaRuta: (
    id: number,
    data: { HojaRutaFecha: string; Id_Vehiculo: number; Id_Chofer: number },
  ) =>
    request<void>(`hojaruta/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ Id: id, ...data }),
    }),
  borrarHojaRuta: (id: number) =>
    request<void>(`hojaruta/${id}`, { method: 'DELETE' }),
  detalleHojaRuta: (id: number, signal?: AbortSignal) =>
    request<Parada[]>(`detallehojaruta/hojaruta/${id}`, { signal }),
  actualizarParada: (parada: Parada) =>
    request<Parada>(`detallehojaruta/${parada.Id_Detalle_HDR}`, {
      method: 'PUT',
      body: JSON.stringify(parada),
    }),
  crearParada: (parada: Omit<Parada, 'Id_Detalle_HDR'>) =>
    request<Parada>('detallehojaruta', {
      method: 'POST',
      body: JSON.stringify({ Id_Detalle_HDR: 0, ...parada }),
    }),
  borrarParada: (id: number) =>
    request<void>(`detallehojaruta/${id}`, { method: 'DELETE' }),
  tiposMovimiento: (signal?: AbortSignal) =>
    request<CatalogItem[]>('tipomovimientos', { signal }),
  recursosMovilizados: (signal?: AbortSignal) =>
    request<CatalogItem[]>('recursosmovilizados', { signal }),
  origenes: (signal?: AbortSignal) =>
    request<CatalogItem[]>('origen', { signal }),
  materiales: (signal?: AbortSignal) =>
    request<CatalogItem[]>('TP_Material/ListarTodo', { signal }),
  estadosHojaRuta: (signal?: AbortSignal) =>
    request<CatalogItem[]>('EST_HDR/ListarTodo', { signal }),
  pesoBruto: (signal?: AbortSignal) =>
    request<PesoBruto[]>('Dashboard/PesoBrutoAcumulado', { signal }),
  rendimiento: (signal?: AbortSignal) =>
    request<Rendimiento[]>('Dashboard/RendimientoClasificacion', { signal }),
  stockNeto: (signal?: AbortSignal) =>
    request<StockNeto[]>('MovimientoSalida/StockNeto', { signal }),
  odometros: (signal?: AbortSignal) =>
    request<Odometro[]>('registroodometro', { signal }),
  guardarOdometro: (
    registro: Pick<Odometro, 'IdVehiculo' | 'InicioOdom' | 'FinalOdom'>,
  ) =>
    request<Odometro>('registroodometro', {
      method: 'POST',
      body: JSON.stringify({ IdRegistroOdomet: 0, ...registro }),
    }),
};
