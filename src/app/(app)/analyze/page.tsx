import { createClient } from "@/lib/supabase/server";
import { PROFILE_ROW_SELECT, rowToProfile } from "@/lib/supabase/profile-row";
import { AnalyzeClient } from "@/components/features/analyze-client";

export default async function AnalyzePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialProfile = null;
  if (user) {
    const { data: row } = await supabase
      .from("profiles")
      .select(PROFILE_ROW_SELECT)
      .eq("id", user.id)
      .maybeSingle();
    initialProfile = row ? rowToProfile(row) : null;
  }

  return <AnalyzeClient initialProfile={initialProfile} isAuthenticated={!!user} />;
}
