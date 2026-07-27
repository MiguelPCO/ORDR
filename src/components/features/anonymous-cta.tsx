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
      className="w-full rounded-md border border-foreground/20 px-4 py-2.5 text-sm font-medium sm:w-auto"
    >
      Probar sin cuenta
    </button>
  );
}
