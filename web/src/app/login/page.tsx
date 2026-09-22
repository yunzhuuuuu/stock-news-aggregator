import { redirect } from "next/navigation";
import AuthPage from "@/components/auth-page";
import SetupPage from "@/components/setup-page";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

type LoginProps = {
  searchParams: Promise<{ authError?: string }>;
};

export default async function Login({ searchParams }: LoginProps) {
  if (!hasSupabaseConfig()) return <SetupPage />;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  const { authError } = await searchParams;
  return <AuthPage authError={authError} />;
}
