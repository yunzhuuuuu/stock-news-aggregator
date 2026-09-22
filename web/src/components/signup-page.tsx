"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  authenticate,
  type AuthActionState,
} from "@/app/auth/actions";

const emptyAuthState: AuthActionState = {};

export default function SignupPage() {
  const [state, action, pending] = useActionState(
    authenticate,
    emptyAuthState,
  );

  if (state.status === "signup-success") {
    return (
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="confirmation-title">
          <div className="brand auth-brand" aria-label="Stock News Aggregator">
            <span className="brand-mark" aria-hidden="true">S</span>
            <span>Stock News Aggregator</span>
          </div>
          <p className="eyebrow">ONE MORE STEP</p>
          <h1 id="confirmation-title">Check your email.</h1>
          <div className="auth-success-box" role="status">
            <p>Supabase sent a confirmation link to:</p>
            <strong>{state.email}</strong>
          </div>
          <p className="auth-copy">
            Open that link to confirm your account. You will return to Stock News
            Aggregator with your confirmed session.
          </p>
          <Link className="button button-light auth-submit auth-back-link" href="/login">
            Back to sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="signup-title">
        <div className="brand auth-brand" aria-label="Stock News Aggregator">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>Stock News Aggregator</span>
        </div>
        <p className="eyebrow">CREATE YOUR ACCOUNT</p>
        <h1 id="signup-title">Start your portfolio.</h1>
        <p className="auth-copy">
          Your account keeps your manually entered holdings separate from every
          other user.
        </p>

        <form className="auth-form" action={action}>
          <label htmlFor="signup-email">Email</label>
          <input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <label htmlFor="signup-password">Password</label>
          <input
            id="signup-password"
            name="password"
            type="password"
            minLength={6}
            autoComplete="new-password"
            required
          />
          <label htmlFor="confirm-password">Confirm password</label>
          <input
            id="confirm-password"
            name="confirmPassword"
            type="password"
            minLength={6}
            autoComplete="new-password"
            required
          />
          {state.error && (
            <p className="form-feedback form-feedback-error" role="alert">
              {state.error}
            </p>
          )}
          <button
            className="button button-primary auth-submit"
            name="intent"
            value="signup"
            disabled={pending}
          >
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="auth-note">
          Supabase handles the password and sends a confirmation email. This app
          never stores your password in the positions table.
        </p>
        <Link className="auth-text-link" href="/login">Already have an account? Sign in</Link>
      </section>
    </main>
  );
}
