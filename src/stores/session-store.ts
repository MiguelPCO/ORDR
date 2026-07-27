import { create } from "zustand";
import { persist } from "zustand/middleware";

// D1 — "probar sin cuenta": solo marca la elección de UI, no sustituye la sesión real
// de Supabase. Vive en sessionStorage: se pierde al cerrar la pestaña, igual que
// el pipeline en memoria que habilita (nada se persiste).
interface SessionState {
  isAnonymous: boolean;
  enterAnonymous: () => void;
  exitAnonymous: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isAnonymous: false,
      enterAnonymous: () => set({ isAnonymous: true }),
      exitAnonymous: () => set({ isAnonymous: false }),
    }),
    {
      name: "ordr-session",
      storage: {
        getItem: (name) => {
          const value = sessionStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => sessionStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => sessionStorage.removeItem(name),
      },
    }
  )
);
