"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthActionState = {
  error?: string;
  status?: "signup-success";
  email?: string;
};

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
  };
}

function friendlyAuthError(message: string) {
  if (message.toLowerCase().includes("rate limit")) {
    return "This Supabase test project has sent too many authentication emails. Wait for the email limit to reset, then try again.";
  }
  return message;
}

/**
 * Server Actions run on the server even though a browser form starts them.
 * Passwords go directly to Supabase Auth and are never written to our database.
 */
export async function authenticate(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const intent = String(formData.get("intent") ?? "");
  const { email, password } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Enter both your email and password." };
  }
  if (password.length < 6) {
    return { error: "Your password must contain at least 6 characters." };
  }

  const supabase = await createClient();

  if (intent === "login") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendlyAuthError(error.message) };
    redirect("/");
  }

  if (intent === "signup") {
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      return { error: "The two passwords do not match." };
    }

    const requestHeaders = await headers();
    const origin = requestHeaders.get("origin") ?? "http://localhost:3000";
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/confirm` },
    });

    if (error) return { error: friendlyAuthError(error.message) };
    return { status: "signup-success", email };
  }

  return { error: "Choose Sign in or Create account." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
