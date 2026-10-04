import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useRef } from 'react';
import { sitmasApi } from '../services/sitmas-api';
import { useSessionStore } from '../state/session-store';

// TanStack: las claves identifican la caché; invalidar hojas también alcanza sus tareas.
export const keys = {
  vehiculos: ['vehiculos'],
  marcas: ['marcas'],
  modelos: ['modelos'],
  tipos: ['tiposVehiculo'],
  odometros: ['odometros'],
  pendientes: ['tareasPendientes'],
  hojas: ['hojasRuta'],
  paradas: (id: number) => ['hojasRuta', id, 'paradas'] as const,
  movimientos: ['tiposMovimiento'],
  recursos: ['recursosMovilizados'],
  origenes: ['origenes'],
  materiales: ['materiales'],
  estados: ['estadosHojaRuta'],
  pesos: ['dashboard', 'pesos'],
  rendimiento: ['dashboard', 'rendimiento'],
  stock: ['dashboard', 'stock'],
} as const;

function options<T>(
  queryKey: QueryKey,
  fetcher: (signal?: AbortSignal) => Promise<T>,
  catalog = false,
) {
  return queryOptions({
    queryKey,
    // TanStack entrega la señal para cancelar peticiones que ya no se necesitan.
    queryFn: ({ signal }) => fetcher(signal),
    staleTime: catalog ? 5 * 60_000 : 30_000,
  });
}

// Una misma clave comparte respuesta, carga y caché entre todas las pantallas.
export const queries = {
  pendientes: options(keys.pendientes, sitmasApi.tareasPendientes),
  vehiculos: options(keys.vehiculos, sitmasApi.vehiculos),
  marcas: options(keys.marcas, sitmasApi.marcas, true),
  modelos: options(keys.modelos, sitmasApi.modelos, true),
  tipos: options(keys.tipos, sitmasApi.tiposVehiculo, true),
  odometros: options(keys.odometros, sitmasApi.odometros),
  hojas: options(keys.hojas, sitmasApi.hojasRuta),
  paradas: (id: number) =>
    options(keys.paradas(id), (signal) =>
      sitmasApi.detalleHojaRuta(id, signal),
    ),
  movimientos: options(keys.movimientos, sitmasApi.tiposMovimiento, true),
  recursos: options(keys.recursos, sitmasApi.recursosMovilizados, true),
  origenes: options(keys.origenes, sitmasApi.origenes, true),
  materiales: options(keys.materiales, sitmasApi.materiales, true),
  estados: options(keys.estados, sitmasApi.estadosHojaRuta, true),
  pesos: options(keys.pesos, sitmasApi.pesoBruto),
  rendimiento: options(keys.rendimiento, sitmasApi.rendimiento),
  stock: options(keys.stock, sitmasApi.stockNeto),
};

export function useSitmasQuery<T>(
  config: ReturnType<typeof options<T>>,
  enabled = true,
) {
  // Zustand selecciona solo la sesión; sin login, TanStack no consulta la API.
  const signedIn = useSessionStore((state) => state.session !== null);
  return useQuery({ ...config, enabled: signedIn && enabled });
}

/** Mutaciones sin reintentos; también releemos después de un fallo parcial. */
export function useSitmasMutation<T, V>(
  mutationFn: (variables: V) => Promise<T>,
  affected: readonly QueryKey[],
) {
  const client = useQueryClient();
  const inFlight = useRef(false);
  const mutation = useMutation({
    mutationFn,
    // Tras guardar (o un fallo parcial), releer solo las listas afectadas.
    onSettled: async () => {
      await Promise.all(
        affected.map((queryKey) => client.invalidateQueries({ queryKey })),
      );
    },
  });
  // El ref bloquea dobles clics antes de que React renderice isPending.
  async function run(variables: V) {
    if (inFlight.current) throw new Error('Ya hay una operación en curso.');
    inFlight.current = true;
    try {
      return await mutation.mutateAsync(variables);
    } finally {
      inFlight.current = false;
    }
  }
  return { ...mutation, run };
}
