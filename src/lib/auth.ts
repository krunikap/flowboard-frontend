import axios from "axios";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export type AuthUser = { id: number; name?: string | null; email: string; created_at?: string; updated_at?: string };
function message(error: unknown) {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as { detail?: string; message?: string } | string | undefined;
    if (typeof body === "string") return body;
    if (body?.detail) return body.detail;
    if (body?.message) return body.message;
    if (!error.response) return "Could not reach the API server at " + API_URL;
  }
  return error instanceof Error ? error.message : "Something went wrong.";
}
export async function login(email: string, password: string) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password }, { headers: { "Content-Type": "application/json" } });
    return { token: response.data.access_token as string, user: response.data.user as AuthUser };
  } catch (error) { throw new Error(message(error)); }
}
export async function register(name: string, email: string, password: string) {
  try {
    await axios.post(`${API_URL}/auth/register`, { name: name.trim() || undefined, email, password }, { headers: { "Content-Type": "application/json" } });
  } catch (error) { throw new Error(message(error)); }
}
export async function getCurrentUser(token: string): Promise<AuthUser> {
  // The guide does not define a current-user endpoint. The login response is authoritative.
  const stored = window.localStorage.getItem("flowboard.auth.user");
  if (!token || !stored) throw new Error("Your session could not be restored. Please sign in again.");
  return JSON.parse(stored) as AuthUser;
}
export async function logout(token: string) {
  try { await axios.post(`${API_URL}/auth/logout`, {}, { headers: { Authorization: `Bearer ${token}` } }); }
  catch { /* Clear the local session even if revocation cannot reach the API. */ }
}
