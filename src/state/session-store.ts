import { create } from 'zustand';
import type { Session } from '../services/sitmas-api';
import { queryClient } from '../query/client';

type SessionState = {
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
};

// En memoria: no persistimos credenciales. Los datos remotos viven en Query.
export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  signIn: (session) => {
    queryClient.clear();
    set({ session });
  },
  signOut: () => {
    // La interfaz también bloquea salir mientras se confirma una escritura.
    if (queryClient.isMutating()) return;
    set({ session: null });
    void queryClient.cancelQueries();
    queryClient.clear();
  },
}));
