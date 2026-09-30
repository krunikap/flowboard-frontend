import { api } from "@/lib/api";
import type { User } from "@/app/projects/types";

type UserRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UserRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapUsers(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!isRecord(payload)) return [];

  const candidates = [payload.users, payload.data, payload.results];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (isRecord(candidate)) {
      for (const key of ["items", "users", "results"]) {
        if (Array.isArray(candidate[key])) return candidate[key] as unknown[];
      }
    }
  }
  return [];
}

function toUser(value: unknown): User | null {
  if (!isRecord(value)) return null;
  const id = value.id ?? value.userId ?? value._id;
  const name = value.name ?? value.fullName ?? value.username;
  if (id === undefined || name === undefined) return null;

  const displayName = String(name);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  return {
    id: String(id),
    name: displayName,
    email: String(value.email ?? ""),
    avatar: String(value.avatar ?? value.avatarUrl ?? initials),
    role: String(value.role ?? value.title ?? "Team member"),
  };
}

export async function getUsers(search?: string): Promise<User[]> {
  const endpoint = process.env.USERS_API_URL ?? `${process.env.API_URL ?? "http://localhost:4000"}/api/users`;
  const { data } = await api.get<unknown>(endpoint, {
    params: { page: 1, limit: 25, ...(search ? { search } : {}) },
  });
  console.log("user",data)
  return unwrapUsers(data).map(toUser).filter((user): user is User => user !== null);
}
