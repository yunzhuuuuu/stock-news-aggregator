"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  authenticate,
  type AuthActionState,
} from "@/app/auth/actions";

const emptyAuthState: AuthActionState = {};

export default function AuthPage({ authError }: { authError?: string }) {
  const [state, action, pending] = useActionState(
    authenticate,
    emptyAuthState,
  );

  const feedback = authError || state.error;

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand auth-brand" aria-label="Stock News Aggregator">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Stock News Aggregator</span>
        </div>
        <p className="eyebrow">SECURE PORTFOLIO ACCESS</p>
        <h1 id="auth-title">Save your portfolio.</h1>
        <p className="auth-copy">
          Sign in to see only the holdings saved to your account.
        </p>

        <form className="auth-form" action={action}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={6}
            autoComplete="current-password"
            required
          />
          {feedback && (
            <p className="form-feedback form-feedback-error" role="alert">
              {feedback}
            </p>
          )}
          <button
            className="button button-primary auth-submit"
            name="intent"
            value="login"
            disabled={pending}
          >
            {pending ? "Please wait…" : "Sign in"}
          </button>
        </form>

        <div className="auth-separator" aria-hidden="true">
          <span>New to Stock News Aggregator?</span>
        </div>
        <Link className="button button-light auth-submit auth-back-link" href="/signup">
          Create account
        </Link>

        <p className="auth-note">
          New accounts may need email confirmation before the first sign-in.
          Passwords are handled by Supabase Auth, not stored in this app.
        </p>
      </section>
    </main>
  );
}
