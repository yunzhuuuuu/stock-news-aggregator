import { redirect } from "next/navigation";
import SignupPage from "@/components/signup-page";
import SetupPage from "@/components/setup-page";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Signed-in users already have an account, so send them to the dashboard. */
export default async function Signup() {
  if (!hasSupabaseConfig()) return <SetupPage />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");
  return <SignupPage />;
}
