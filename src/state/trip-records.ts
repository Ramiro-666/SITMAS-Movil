export type TripRecord = {
  userId: number; routeId: number; vehicleId: number; odometerId: number; start: number;
  phase: 'open' | 'saving-return' | 'closing-odometer' | 'odometer-closed';
  returnId?: number; final?: number; distanceKm?: number;
};
type Storage = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; removeItem: (key: string) => void };
const memory = new Map<string, string>();
const memoryStorage: Storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: (key) => { memory.delete(key); } };
let storage: Storage = memoryStorage;
export function configureTripStorage(adapter: Storage) { storage = adapter; }
export function resetTripMemory() { memory.clear(); storage = memoryStorage; }
const key = (userId: number, routeId: number) => `sitmas-trip-${userId}-${routeId}`;
export function getTripRecord(userId: number, routeId: number): TripRecord | null {
  const raw = storage.getItem(key(userId, routeId));
  if (!raw) return null;
  const record = JSON.parse(raw) as TripRecord;
  if (!record || record.userId !== userId || record.routeId !== routeId || !Number.isInteger(record.odometerId) || record.odometerId <= 0 || !Number.isInteger(record.vehicleId) || record.vehicleId <= 0 || !Number.isFinite(record.start) || record.start < 0 || !['open', 'saving-return', 'closing-odometer', 'odometer-closed'].includes(record.phase) || (record.phase !== 'open' && (!Number.isFinite(record.final) || !Number.isFinite(record.distanceKm))) || (record.returnId !== undefined && (!Number.isInteger(record.returnId) || record.returnId <= 0)) || (record.final !== undefined && (!Number.isFinite(record.final) || record.final < record.start)) || (record.distanceKm !== undefined && (!Number.isFinite(record.distanceKm) || record.distanceKm < 0))) throw new Error('El registro local del viaje no es válido. Revisalo con el administrador.');
  return record;
}
export function saveTripRecord(record: TripRecord) { storage.setItem(key(record.userId, record.routeId), JSON.stringify(record)); }
export function clearTripRecord(userId: number, routeId: number) { storage.removeItem(key(userId, routeId)); }
