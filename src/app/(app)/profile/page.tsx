import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "@/components/features/profile-form";
import { PROFILE_ROW_SELECT, rowToProfile } from "@/lib/supabase/profile-row";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("profiles")
    .select(PROFILE_ROW_SELECT)
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div>
      {params.saved && (
        <p className="mx-auto mt-6 max-w-lg rounded-md bg-brand-soft px-3 py-2 text-center text-sm text-brand-on-soft">
          Perfil guardado.
        </p>
      )}
      {params.error && (
        <p className="mx-auto mt-6 max-w-lg rounded-md bg-red-500/10 px-3 py-2 text-center text-sm text-red-700 dark:text-red-400">
          {params.error}
        </p>
      )}
      <ProfileForm profile={row ? rowToProfile(row) : null} />
    </div>
  );
}
