import axios from "axios";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? process.env.API_URL ?? "http://localhost:4000").replace(/\/$/, "");

type ApiEnvelope<T> = { data?: T; message?: string; error?: string };
export type AuthUser = { id?: string | number; email: string; name?: string; [key: string]: unknown };

function getMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as ApiEnvelope<unknown> | string | undefined;
    if (typeof body === "string" && body.trim()) return body;
    if (body && typeof body === "object") {
      const message = body.message ?? body.error;
      if (typeof message === "string" && message.trim()) return message;
    }
    if (!error.response) return "Could not reach the server. Check your connection and try again.";
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

async function postCredentials(path: "login" | "register", payload: Record<string, string>) {
  try {
    const response = await axios.post<ApiEnvelope<{ token?: string; user?: AuthUser }>>(
      `${API_URL}/api/auth/${path}`,
      payload,
      { headers: { Accept: "application/json", "Content-Type": "application/json" }, timeout: 15000 },
    );
    const token = response.data?.data?.token;
    if (!token) throw new Error("The server response did not include an access token.");
    return { token, user: response.data.data?.user };
  } catch (error) {
    throw new Error(getMessage(error));
  }
}

export const login = (email: string, password: string) => postCredentials("login", { email, password });
export const register = (email: string, name: string, password: string) => postCredentials("register", { email, name, password });

export async function getCurrentUser(token: string): Promise<AuthUser> {
  try {
    const response = await axios.get<ApiEnvelope<AuthUser>>(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, timeout: 15000,
    });
    const user = response.data?.data;
    const profile = user && typeof user === "object" && "user" in user
      ? (user as { user?: AuthUser }).user
      : user;
    if (!profile || typeof profile !== "object" || typeof profile.email !== "string") {
      throw new Error("The server returned an invalid user profile.");
    }
    return profile;
  } catch (error) {
    throw new Error(getMessage(error));
  }
}
