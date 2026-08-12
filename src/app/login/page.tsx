"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, signup, type AuthState } from "./actions";

const initialState: AuthState = {};

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState
  );

  const state = mode === "login" ? loginState : signupState;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Cine<span style={{ color: "var(--accent)" }}>Milar</span>
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
      </div>

      <div className="card flex flex-col gap-4">
        <form
          action={mode === "login" ? loginAction : signupAction}
          className="flex flex-col gap-4"
        >
          <label className="field">
            Email
            <input type="email" name="email" required className="field-input" />
          </label>
          <label className="field">
            Password
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="field-input"
            />
          </label>

          {state?.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          {state?.message && (
            <p role="status" className="text-sm text-green-700">
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={loginPending || signupPending}
            className="btn-primary w-full"
          >
            {mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>
      </div>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="btn-ghost mx-auto"
      >
        {mode === "login"
          ? "Need an account? Sign up"
          : "Already have an account? Log in"}
      </button>
    </main>
  );
}
