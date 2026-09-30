"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth-provider";

export default function LoginPage() {
  const router = useRouter();
  const { user, isLoading, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) router.replace("/projects");
  }, [user, router]);

  if (isLoading) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Restoring your session…</main>;
  if (user) return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500">Opening your workspace…</main>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") await signUp(email.trim(), name.trim(), password);
      else await signIn(email.trim(), password);
      router.replace("/projects");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to authenticate. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:grid sm:place-items-center sm:py-16">
      <div className="mx-auto w-full max-w-md">
        <Link href="/projects" className="mb-8 flex items-center justify-center gap-2 text-xl font-bold tracking-tight text-slate-900">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white">F</span> Flowboard
        </Link>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-7">
            <p className="text-sm font-semibold text-indigo-600">YOUR WORKSPACE</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
            <p className="mt-2 text-sm text-slate-500">{mode === "login" ? "Sign in to continue to your Flowboard workspace." : "Get started with your Flowboard workspace."}</p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1" role="tablist" aria-label="Authentication">
            {(["login", "register"] as const).map((item) => (
              <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => { setMode(item); setError(""); }} className={`rounded-md px-3 py-2 text-sm font-semibold capitalize transition ${mode === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
                {item === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && <label className="block text-sm font-medium text-slate-700">Full name<input autoComplete="name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Alex Morgan" /></label>}
            <label className="block text-sm font-medium text-slate-700">Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="you@example.com" /></label>
            <label className="block text-sm font-medium text-slate-700">Password<div className="relative mt-1.5"><input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required value={password} onChange={(event) => setPassword(event.target.value)} className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-16 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Enter your password" /><button type="button" onClick={() => setShowPassword((shown) => !shown)} className="absolute inset-y-0 right-3 text-xs font-semibold text-slate-500 hover:text-slate-800" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">{error}</p>}
            <button type="submit" disabled={busy} className="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-slate-400">By continuing, you agree to use this workspace in accordance with your organization’s policies.</p>
        </section>
      </div>
    </main>
  );
}
