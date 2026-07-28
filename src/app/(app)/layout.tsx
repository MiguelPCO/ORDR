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
          <Link href="/analyze" className="transition-colors hover:text-brand-dark">
            Analizar
          </Link>
          <Link href="/profile" className="transition-colors hover:text-brand-dark">
            Perfil
          </Link>
          <Link href="/history" className="transition-colors hover:text-brand-dark">
            Historial
          </Link>
        </nav>
        {user ? (
          <form action={signOut}>
            <button type="submit" className="text-sm text-foreground/60 underline underline-offset-2">
              Salir ({user.email})
            </button>
          </form>
        ) : (
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-dark">
            Modo invitado
          </span>
        )}
      </header>
      {children}
    </div>
  );
}
