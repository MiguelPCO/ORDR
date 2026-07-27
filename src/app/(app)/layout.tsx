import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/analyze">Analizar</Link>
          <Link href="/profile">Perfil</Link>
          <Link href="/history">Historial</Link>
        </nav>
        {user ? (
          <form action={signOut}>
            <button type="submit" className="text-sm text-foreground/60 underline underline-offset-2">
              Salir ({user.email})
            </button>
          </form>
        ) : (
          <span className="text-sm text-foreground/60">Modo invitado</span>
        )}
      </header>
      {children}
    </div>
  );
}
