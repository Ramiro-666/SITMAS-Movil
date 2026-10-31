export async function permisoNotificaciones(_request = false) { return true; }
export async function notificarFinViaje(_routeId: number, _eventId: string) {}
export function ultimoAvisoViaje(userId: number) { return localStorage.getItem(`sitmas-trip-alert-${userId}`); }
export function marcarAvisoViaje(userId: number, id: string) { localStorage.setItem(`sitmas-trip-alert-${userId}`, id); }
