"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, login as loginRequest, logout as logoutRequest, register as registerRequest, type AuthUser } from "@/lib/auth";

const TOKEN_KEY = "flowboard.auth.token";
function clearStoredToken() {
  try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* Storage may be disabled. */ }
}
type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const acceptSession = useCallback(async (nextToken: string, suppliedUser?: AuthUser) => {
    setToken(nextToken);
    try { window.localStorage.setItem(TOKEN_KEY, nextToken); if (suppliedUser) window.localStorage.setItem("flowboard.auth.user", JSON.stringify(suppliedUser)); } catch { /* Keep this session in memory for the current tab. */ }
    try {
      const currentUser = await getCurrentUser(nextToken);
      setUser(currentUser);
    } catch (error) {
      if (suppliedUser) setUser(suppliedUser);
      else {
        clearStoredToken();
        setToken(null);
        throw error;
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    let storedToken: string | null = null;
    try {
      storedToken = window.localStorage.getItem(TOKEN_KEY);
    } catch {
      // Storage can be disabled by browser privacy settings. The app can still
      // render and users can retry signing in for the current tab.
    }
    if (!storedToken) {
      queueMicrotask(() => { if (active) setIsLoading(false); });
      return () => { active = false; };
    }
    getCurrentUser(storedToken)
      .then((currentUser) => {
        if (active) {
          setToken(storedToken);
          setUser(currentUser);
        }
      })
      .catch(() => {
        if (active) {
          clearStoredToken();
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await loginRequest(email, password);
    await acceptSession(result.token, result.user);
  }, [acceptSession]);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    await registerRequest(name, email, password);
  }, []);
  const signOut = useCallback(() => {
    if (token) void logoutRequest(token);
    clearStoredToken();
    try { window.localStorage.removeItem("flowboard.auth.user"); } catch { /* Storage may be disabled. */ }
    setToken(null);
    setUser(null);
  }, [token]);

  const value = useMemo(() => ({ user, token, isLoading, signIn, signUp, signOut }), [user, token, isLoading, signIn, signUp, signOut]);
  return (
    <AuthContext.Provider value={value}>
      <AuthRouteGate isLoading={isLoading} user={user}>{children}</AuthRouteGate>
    </AuthContext.Provider>
  );
}

function AuthRouteGate({ isLoading, user, children }: { isLoading: boolean; user: AuthUser | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isAuthPage = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (!isLoading && !user && !isAuthPage) router.replace("/login");
    if (!isLoading && user && isAuthPage) router.replace("/");
  }, [isLoading, user, isAuthPage, router]);

  if (isLoading || (!user && !isAuthPage) || (user && isAuthPage)) {
    return <main className="grid min-h-screen place-items-center bg-slate-50 text-sm text-slate-500" role="status">{isLoading ? "Restoring your session…" : "Opening your workspace…"}</main>;
  }
  return children;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
