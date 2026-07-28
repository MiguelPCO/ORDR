"use client";

import { useRouter } from "next/navigation";
import { useSessionStore } from "@/stores/session-store";

export function AnonymousCta() {
  const router = useRouter();
  const enterAnonymous = useSessionStore((s) => s.enterAnonymous);

  return (
    <button
      type="button"
      onClick={() => {
        enterAnonymous();
        router.push("/analyze");
      }}
      className="w-full rounded-md border border-brand-dark/50 px-4 py-2.5 text-sm font-medium text-brand-dark transition-colors hover:bg-brand-soft sm:w-auto"
    >
      Probar sin cuenta
    </button>
  );
}
