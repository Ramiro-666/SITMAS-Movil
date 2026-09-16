/** Cliente de la API SITMAS. Nunca conecta la aplicación directamente a SQL Server. */
const configuredBase = process.env.EXPO_PUBLIC_SITMAS_API_URL ?? 'https://localhost:44325/api';
const baseUrl = configuredBase.replace(/\/$/, '');

export type Session = { idUsuario: number; nombre: string; rol: string; permisos?: unknown[] };
export type Vehiculo = { Id: number; Patente: string; Id_Modelo: number; Id_Tipo: number };
export type HojaRuta = { Id: number; FechaFormateada?: string; Vehiculo?: string; ChoferNombreCompleto?: string; Id_Vehiculo?: number; Id_Chofer?: number; HojaRutaFecha?: string };
export type PesoBruto = { Categoria: string; SubtipoMaterial: string; TotalPesoBrutoKg: number; CantidadPesadas: number };
export type Rendimiento = { Categoria: string; SubtipoMaterial: string; TotalPesoBrutoKg: number; TotalPesoUtilKg: number; TotalDescarteKg: number; PorcentajeRecuperacion: number };
export type StockNeto = { Categoria: string; SubtipoMaterial: string; StockDisponibleKg: number };
export type Odometro = { IdRegistroOdomet: number; IdVehiculo: number; Patente?: string; FechaRegOdomFormateada?: string; InicioOdom: number; FinalOdom: number; KmRecorridosDia?: number };
export type Marca = { Id: number; MarcaVehiculo: string };
export type Modelo = { Id: number; ModeloVehiculo: string; Id_Marca: number };
export type TipoVehiculo = { Id?: number; id_Tp_Vehiculo?: number; Tp_Vehiculo?: string; TipoVehiculo?: string };
export type Chofer = { Id: number; Nombre?: string; Apellido?: string };
export type Parada = { Id_Detalle_HDR: number; Id_HojaRuta: number; Id_TipoMovimiento: number; Id_RecursoMov: number; Id_Origen: number; Id_TipoMaterial: number; Id_Estado: number; HoraEstimada?: string; HoraEstimadaFormateada?: string; TipoMovimiento?: string; RecursoMovilizado?: string; Origen?: string; TipoMaterial?: string; EstadoRecorrido?: string };
export type CatalogItem = Record<string, string | number | undefined>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}/${path.replace(/^\//, '')}`, {
    ...init,
    headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  const body = await response.text();
  let data: unknown = body;
  try { data = body ? JSON.parse(body) : undefined; } catch { /* respuesta de texto */ }
  if (!response.ok) throw new Error(typeof data === 'object' && data ? JSON.stringify(data) : body || `Error ${response.status}`);
  return data as T;
}

export const sitmasApi = {
  login: (Usuario: string, Password: string) => request<Session>('Usuario/Login', { method: 'POST', body: JSON.stringify({ Usuario, Password }) }),
  vehiculos: () => request<Vehiculo[]>('Vehiculo/ListarTodo'),
  guardarVehiculo: (data: Pick<Vehiculo, 'Patente' | 'Id_Modelo' | 'Id_Tipo'>, id?: number) => request<void>(id ? `Vehiculo/Modificar/${id}` : 'Vehiculo/Insertar', { method: 'POST', body: JSON.stringify(data) }),
  borrarVehiculo: (id: number) => request<void>(`Vehiculo/Borrar/${id}`, { method: 'POST' }),
  tiposVehiculo: () => request<TipoVehiculo[]>('Tp_Vehiculo/ListarTodo'),
  guardarTipoVehiculo: (nombre: string, id?: number) => request<void>(id ? `Tp_Vehiculo/Modificar/${id}` : 'Tp_Vehiculo/Insertar', { method: 'POST', body: JSON.stringify({ TipoVehiculo: nombre }) }),
  borrarTipoVehiculo: (id: number) => request<void>(`Tp_Vehiculo/Borrar/${id}`, { method: 'POST' }),
  marcas: () => request<Marca[]>('MarcaVeh/ListarTodo'),
  modelos: () => request<Modelo[]>('ModeloVeh/ListarTodo'),
  guardarMarca: (nombre: string, id?: number) => request<void>(id ? `MarcaVeh/Modificar/${id}` : 'MarcaVeh/Insertar', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ MarcaVehiculo: nombre }) }),
  borrarMarca: (id: number) => request<void>(`MarcaVeh/Borrar/${id}`, { method: 'DELETE' }),
  guardarModelo: (nombre: string, idMarca: number, id?: number) => request<void>(id ? `ModeloVeh/Modificar/${id}` : 'ModeloVeh/Insertar', { method: id ? 'PUT' : 'POST', body: JSON.stringify({ ModeloVehiculo: nombre, Id_Marca: idMarca }) }),
  borrarModelo: (id: number) => request<void>(`ModeloVeh/Borrar/${id}`, { method: 'DELETE' }),
  hojasRuta: () => request<HojaRuta[]>('hojaruta'),
  hojaRuta: (id: number) => request<HojaRuta>(`hojaruta/${id}`),
  choferes: () => request<Chofer[]>('Empleado/ListarChoferes'),
  crearHojaRuta: (data: { HojaRutaFecha: string; Id_Vehiculo: number; Id_Chofer: number }) => request<{ IdGenerado: number }>('hojaruta', { method: 'POST', body: JSON.stringify({ Id: 0, ...data }) }),
  actualizarHojaRuta: (id: number, data: { HojaRutaFecha: string; Id_Vehiculo: number; Id_Chofer: number }) => request<void>(`hojaruta/${id}`, { method: 'PUT', body: JSON.stringify({ Id: id, ...data }) }),
  borrarHojaRuta: (id: number) => request<void>(`hojaruta/${id}`, { method: 'DELETE' }),
  detalleHojaRuta: (id: number) => request<Parada[]>(`detallehojaruta/hojaruta/${id}`),
  actualizarParada: (parada: Parada) => request<Parada>(`detallehojaruta/${parada.Id_Detalle_HDR}`, { method: 'PUT', body: JSON.stringify(parada) }),
  crearParada: (parada: Omit<Parada, 'Id_Detalle_HDR'>) => request<Parada>('detallehojaruta', { method: 'POST', body: JSON.stringify({ Id_Detalle_HDR: 0, ...parada }) }),
  borrarParada: (id: number) => request<void>(`detallehojaruta/${id}`, { method: 'DELETE' }),
  tiposMovimiento: () => request<CatalogItem[]>('tipomovimientos'),
  recursosMovilizados: () => request<CatalogItem[]>('recursosmovilizados'),
  origenes: () => request<CatalogItem[]>('Origen/ListarTodo'),
  materiales: () => request<CatalogItem[]>('TP_Material/ListarTodo'),
  estadosHojaRuta: () => request<CatalogItem[]>('EST_HDR/ListarTodo'),
  pesoBruto: () => request<PesoBruto[]>('Dashboard/PesoBrutoAcumulado'),
  rendimiento: () => request<Rendimiento[]>('Dashboard/RendimientoClasificacion'),
  stockNeto: () => request<StockNeto[]>('MovimientoSalida/StockNeto'),
  odometros: () => request<Odometro[]>('registroodometro'),
  guardarOdometro: (registro: Pick<Odometro, 'IdVehiculo' | 'InicioOdom' | 'FinalOdom'>) => request<Odometro>('registroodometro', { method: 'POST', body: JSON.stringify({ IdRegistroOdomet: 0, ...registro }) }),
};

export const apiConfigurationHint = configuredBase === 'https://localhost:44325/api'
  ? 'Para Expo Go en el teléfono, definí EXPO_PUBLIC_SITMAS_API_URL con la IP LAN de tu PC; localhost solo funciona en el emulador o web local.'
  : '';
