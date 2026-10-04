import { create } from 'zustand';

type BoardState = {
  mapId: number | null;
  assignmentId: number | null;
  draggingId: number | null;
  openMap: (id: number | null) => void;
  selectTask: (id: number | null) => void;
  drag: (id: number | null) => void;
  reset: () => void;
};
// Solo estado de interacción; las tareas y las hojas pertenecen a TanStack Query.
export const useRouteBoardStore = create<BoardState>((set) => ({
  mapId: null, assignmentId: null, draggingId: null,
  // set actualiza solo estos campos y notifica a los componentes suscritos.
  openMap: (mapId) => set({ mapId }),
  selectTask: (assignmentId) => set({ assignmentId }),
  drag: (draggingId) => set({ draggingId }),
  reset: () => set({ mapId: null, assignmentId: null, draggingId: null }),
}));
