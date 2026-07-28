import { create } from "zustand";
import { persist } from "zustand/middleware";
import { z } from "zod";
import { ProfileSchema, type Profile } from "@/schemas";

// Forma serializable (pre-coerción, birthDate como string) — lo que sobrevive un
// round-trip JSON en sessionStorage. Se re-valida con ProfileSchema al leerlo.
type ProfileDraft = z.input<typeof ProfileSchema>;

// D1 — "probar sin cuenta": solo marca la elección de UI, no sustituye la sesión real
// de Supabase. Vive en sessionStorage: se pierde al cerrar la pestaña, igual que
// el pipeline en memoria que habilita (nada se persiste).
interface SessionState {
  isAnonymous: boolean;
  enterAnonymous: () => void;
  exitAnonymous: () => void;
  anonymousProfileDraft: ProfileDraft | null;
  setAnonymousProfile: (p: Profile) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isAnonymous: false,
      enterAnonymous: () => set({ isAnonymous: true }),
      exitAnonymous: () => set({ isAnonymous: false }),
      anonymousProfileDraft: null,
      setAnonymousProfile: (p) =>
        set({
          anonymousProfileDraft: { ...p, birthDate: p.birthDate.toISOString().slice(0, 10) },
        }),
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

/** Re-valida el draft persistido (coacciona birthDate: string -> Date). */
export function readAnonymousProfile(draft: ProfileDraft | null): Profile | null {
  if (!draft) return null;
  const parsed = ProfileSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}
