"use client";

import { useActionState, useState } from "react";
import { login, signup, type AuthState } from "./actions";
import { Logo } from "@/components/Logo";
import {
  AlertIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SpinnerIcon,
  HeartIcon,
} from "@/components/Icons";

const initialState: AuthState = {};

const PERKS = [
  { icon: ShieldCheckIcon, text: "Every pick is a real, verified title" },
  { icon: SparklesIcon, text: "Reasons tied to what you told us you loved" },
  { icon: HeartIcon, text: "Your history and saved picks, always at hand" },
];

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
  const pending = loginPending || signupPending;

  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-2">
      {/* Brand panel (desktop only) */}
      <aside className="curtain relative hidden flex-col justify-between overflow-hidden border-r border-accent/20 p-12 lg:flex">
        <Logo />

        <div className="relative max-w-md">
          <p className="eyebrow">Now showing</p>
          <h2 className="mt-3 text-4xl leading-tight font-semibold tracking-tight text-balance">
            Find what to watch next, and know why.
          </h2>
          <ul className="mt-8 flex flex-col gap-4">
            {PERKS.map((perk) => (
              <li key={perk.text} className="flex items-center gap-3 text-foreground/90">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black/30 text-accent ring-1 ring-accent/30">
                  <perk.icon className="h-4.5 w-4.5" />
                </span>
                {perk.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-foreground/60">
          Movies &amp; TV, grounded in real data.
        </p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="animate-fade-up flex w-full max-w-sm flex-col gap-7">
          <Logo className="lg:hidden" />

          <div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {mode === "login"
                ? "Log in to get your next recommendations."
                : "It takes a few seconds and it's free."}
            </p>
          </div>

          <form
            action={mode === "login" ? loginAction : signupAction}
            className="flex flex-col gap-4"
          >
            <label className="field">
              Email
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="field-input"
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                name="password"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder={mode === "login" ? "Your password" : "At least 6 characters"}
                className="field-input"
              />
            </label>

            {state?.error && (
              <p role="alert" className="notice notice-error">
                <AlertIcon className="mt-0.5 h-4 w-4" />
                {state.error}
              </p>
            )}
            {state?.message && (
              <p role="status" className="notice notice-success">
                <CheckCircleIcon className="mt-0.5 h-4 w-4" />
                {state.message}
              </p>
            )}

            <button type="submit" disabled={pending} className="btn-primary w-full py-3">
              {pending && <SpinnerIcon />}
              {mode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="btn-ghost mx-auto"
          >
            {mode === "login"
              ? "Need an account? Sign up"
              : "Already have an account? Log in"}
          </button>
        </div>
      </main>
    </div>
  );
}
