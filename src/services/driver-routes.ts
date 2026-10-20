import type { HojaRuta, Session } from './sitmas-api';

export function isDriverRole(role: string) {
  return role.split(',').some((item) =>
    ['chofer', 'camionero', 'operador-logistica'].includes(item.trim().toLowerCase()));
}

// shortcut: el listado general omite Id_Chofer; comparar nombres hasta que la API devuelva IDs completos.
export function ownRoutes(routes: HojaRuta[], session: Session) {
  return routes.filter((route) => route.ChoferNombreCompleto?.trim() === session.nombre.trim());
}

export function routeDate(route: HojaRuta) {
  if (route.FechaFormateada) return route.FechaFormateada;
  const date = route.HojaRutaFecha?.slice(0, 10);
  return date && !date.startsWith('0001') ? date.split('-').reverse().join('/') : 'Fecha no disponible';
}
