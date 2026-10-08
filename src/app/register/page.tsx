"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/auth-provider";

export default function RegisterPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await signUp(name, email.trim(), password);
      router.push("/login?registered=1");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not create your account."); }
    finally { setBusy(false); }
  }

  return <main className="login-shell"><div className="login-brand"><span className="brand-mark">F</span> Folio<span className="brand-dot">.</span></div><section className="login-card"><div className="eyebrow">GET STARTED</div><h1>Create your account</h1><p>Sign up to start organizing your documents.</p><form onSubmit={submit} className="login-form"><label>Name <span className="optional-label">(optional)</span><input type="text" autoComplete="name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label><label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label><label>Password<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div></label>{error && <div role="alert" className="toast toast-error">{error}</div>}<button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}<span>→</span></button></form><div className="login-help">Already have an account? <Link href="/login">Sign in</Link></div></section><div className="login-foot">Private document library · Secure sign in</div></main>;
}
