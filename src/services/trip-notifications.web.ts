export async function notificationPermission(_request = false) { return true; }
export async function notifyTripClosed(_routeId: number, _eventId: string) {}
export function lastTripAlert(userId: number) { return localStorage.getItem(`sitmas-trip-alert-${userId}`); }
export function markTripAlert(userId: number, id: string) { localStorage.setItem(`sitmas-trip-alert-${userId}`, id); }
