import { configureTripStorage } from './trip-records';
export function initializeTripStorage() {
  configureTripStorage({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  });
}
