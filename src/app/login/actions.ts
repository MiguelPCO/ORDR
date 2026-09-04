"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// El campo "next" viaja en el form desde el query string (?next=...), así que es
// input del atacante: solo se acepta una ruta relativa de un solo "/" (nunca "//" o
// "/\" — ambas son protocol-relative en el navegador) para evitar un open redirect.
function safeNext(next: string): string {
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) return next;
  return "/profile";
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/profile"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
}
