"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/auth-provider";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [registered, setRegistered] = useState(false);
  useEffect(() => { setRegistered(new URLSearchParams(window.location.search).get("registered") === "1"); }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await signIn(email.trim(), password); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not sign in."); }
    finally { setBusy(false); }
  }
  return <main className="login-shell"><div className="login-brand"><span className="brand-mark">F</span> Folio<span className="brand-dot">.</span></div><section className="login-card"><div className="eyebrow">YOUR KNOWLEDGE WORKSPACE</div><h1>Welcome back</h1><p>Sign in to manage your documents and conversations.</p>{registered && <div role="status" className="toast toast-success">Account created. Sign in to continue.</div>}<form onSubmit={submit} className="login-form"><label>Email address<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>{error && <div role="alert" className="toast toast-error">{error}</div>}<button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<span>→</span></button></form><div className="login-help">New here? <Link href="/register">Create an account</Link></div></section><div className="login-foot">Private document library · Secure sign in</div></main>;
}
