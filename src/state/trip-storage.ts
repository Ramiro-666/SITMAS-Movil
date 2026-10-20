import { File, Paths } from 'expo-file-system';
import { configureTripStorage } from './trip-records';
export function initializeTripStorage() {
  configureTripStorage({
    getItem: (key) => { const file = new File(Paths.document, `${key}.json`); return file.exists ? file.textSync() : null; },
    setItem: (key, value) => { const file = new File(Paths.document, `${key}.json`); if (!file.exists) file.create(); file.write(value); },
    removeItem: (key) => { const file = new File(Paths.document, `${key}.json`); if (file.exists) file.delete(); },
  });
}
