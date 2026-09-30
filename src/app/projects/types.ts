// ─── Domain Types ─────────────────────────────────────────────────────────────
// Replace these with your real API response shapes when you integrate.

export type ProjectStatus = "planning" | "in-progress" | "on-hold" | "completed";
export type ProjectPriority = "low" | "medium" | "high";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string; // initials or URL
  role: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate?: string;
  deadline: string; // ISO date string
  assignedUserIds: string[];
  createdAt: string;
}

// ─── Mock users ───────────────────────────────────────────────────────────────
// Swap with a real /api/users fetch when integrating the API.

export const MOCK_USERS: User[] = [
  { id: "u1", name: "Alice Johnson", email: "alice@example.com", avatar: "AJ", role: "Designer" },
  { id: "u2", name: "Bob Smith",     email: "bob@example.com",   avatar: "BS", role: "Developer" },
  { id: "u3", name: "Carol White",   email: "carol@example.com", avatar: "CW", role: "Product Manager" },
  { id: "u4", name: "David Lee",     email: "david@example.com", avatar: "DL", role: "Developer" },
  { id: "u5", name: "Eva Chen",      email: "eva@example.com",   avatar: "EC", role: "QA Engineer" },
  { id: "u6", name: "Frank Ray",     email: "frank@example.com", avatar: "FR", role: "DevOps" },
];

// ─── Mock projects ────────────────────────────────────────────────────────────
// Swap with a real /api/projects fetch when integrating the API.

export const MOCK_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Flowboard Redesign",
    description: "Complete UI overhaul of the Flowboard dashboard to improve usability and aesthetics.",
    status: "in-progress",
    priority: "high",
    deadline: "2026-11-30",
    assignedUserIds: ["u1", "u2", "u3"],
    createdAt: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "p2",
    name: "API Integration Layer",
    description: "Build a unified API integration layer to connect all third-party services.",
    status: "planning",
    priority: "high",
    deadline: "2026-12-15",
    assignedUserIds: ["u2", "u4"],
    createdAt: "2026-09-10T00:00:00.000Z",
  },
  {
    id: "p3",
    name: "Mobile App MVP",
    description: "Launch the minimum viable product of the Flowboard mobile app.",
    status: "on-hold",
    priority: "medium",
    deadline: "2027-01-20",
    assignedUserIds: ["u1", "u4", "u5"],
    createdAt: "2026-09-15T00:00:00.000Z",
  },
  {
    id: "p4",
    name: "Authentication System",
    description: "Implement OAuth 2.0, SSO and two-factor authentication.",
    status: "completed",
    priority: "high",
    deadline: "2026-09-01",
    assignedUserIds: ["u2", "u6"],
    createdAt: "2026-08-01T00:00:00.000Z",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; color: string; dot: string }
> = {
  "planning":    { label: "Planning",     color: "bg-blue-100 text-blue-700",   dot: "bg-blue-500" },
  "in-progress": { label: "In Progress",  color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  "on-hold":     { label: "On Hold",      color: "bg-zinc-100 text-zinc-600",   dot: "bg-zinc-400" },
  "completed":   { label: "Completed",    color: "bg-green-100 text-green-700", dot: "bg-green-500" },
};

export const PRIORITY_CONFIG: Record<
  ProjectPriority,
  { label: string; color: string }
> = {
  "low":    { label: "Low",    color: "text-zinc-500" },
  "medium": { label: "Medium", color: "text-amber-600" },
  "high":   { label: "High",   color: "text-red-600" },
};
