import Link from "next/link";
import { AnonymousCta } from "@/components/features/anonymous-cta";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="max-w-2xl space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">ORDR</h1>
        <p className="text-lg text-foreground/70">
          Elige qué pedir en cualquier carta según tu dieta y tu objetivo, en 10 segundos, con una
          foto.
        </p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:flex-row">
        <Link
          href="/login"
          className="w-full rounded-md bg-foreground px-4 py-2.5 text-sm font-medium text-background sm:w-auto"
        >
          Iniciar sesión
        </Link>
        <AnonymousCta />
      </div>
    </main>
  );
}
