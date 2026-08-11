"use client";

import { useActionState, useState } from "react";
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
      <h1 className="text-2xl font-semibold">
        {mode === "login" ? "Log in to CineMilar" : "Create your account"}
      </h1>

      <form
        action={mode === "login" ? loginAction : signupAction}
        className="flex flex-col gap-4"
      >
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            name="email"
            required
            className="rounded border px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            type="password"
            name="password"
            required
            minLength={6}
            className="rounded border px-3 py-2"
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
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="text-sm underline"
      >
        {mode === "login"
          ? "Need an account? Sign up"
          : "Already have an account? Log in"}
      </button>
    </main>
  );
}
