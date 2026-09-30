"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createProject, updateProject, removeProject } from "./actions";
import type {
  Project,
  ProjectStatus,
  ProjectPriority,
  User,
} from "./types";
import {
  STATUS_CONFIG,
  PRIORITY_CONFIG,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
//  Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isPast(iso: string) {
  return new Date(iso) < new Date();
}

// ─────────────────────────────────────────────────────────────────────────────
//  Avatar chip
// ─────────────────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-pink-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-violet-500",
  "bg-emerald-500",
];

function Avatar({ user, size = "sm" }: { user: User; size?: "sm" | "md" }) {
  const colorIndex =
    user.id.charCodeAt(user.id.length - 1) % AVATAR_COLORS.length;
  const sz = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return (
    <div
      title={`${user.name} — ${user.role}`}
      className={`${sz} ${AVATAR_COLORS[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold ring-2 ring-white select-none shrink-0`}
    >
      {user.avatar}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Status badge
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProjectStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Priority indicator
// ─────────────────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: ProjectPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  const bars =
    priority === "low" ? 1 : priority === "medium" ? 2 : 3;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
      <span className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={`w-1 rounded-sm ${
              i <= bars ? "opacity-100" : "opacity-20"
            } ${cfg.color.replace("text-", "bg-")}`}
            style={{ height: `${i * 4}px` }}
          />
        ))}
      </span>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  User selector (multi-select)
// ─────────────────────────────────────────────────────────────────────────────

function UserSelector({
  allUsers,
  selectedIds,
  onChange,
}: {
  allUsers: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="border border-zinc-200 rounded-xl divide-y divide-zinc-100 max-h-52 overflow-y-auto">
      {allUsers.length === 0 && <p className="px-3 py-4 text-sm text-zinc-500">No team members available.</p>}
      {allUsers.map((user) => {
        const selected = selectedIds.includes(user.id);
        return (
          <label
            key={user.id}
            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-zinc-50 transition-colors ${
              selected ? "bg-indigo-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => toggle(user.id)}
              className="accent-indigo-600 w-4 h-4"
            />
            <Avatar user={user} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-800 truncate">
                {user.name}
              </p>
              <p className="text-xs text-zinc-400 truncate">{user.role}</p>
            </div>
          </label>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Project Form (used in both Create & Edit modal)
// ─────────────────────────────────────────────────────────────────────────────

interface ProjectFormData {
  name: string;
  description: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string;
  deadline: string;
  assignedUserIds: string[];
}

const EMPTY_FORM: ProjectFormData = {
  name: "",
  description: "",
  status: "planning",
  priority: "medium",
  startDate: "",
  deadline: "",
  assignedUserIds: [],
};

function ProjectForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
  error,
  users,
}: {
  initial: ProjectFormData;
  onSubmit: (data: ProjectFormData) => void;
  onCancel: () => void;
  submitLabel: string;
  error?: string;
  users: User[];
}) {
  const [form, setForm] = useState<ProjectFormData>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set<K extends keyof ProjectFormData>(k: K, v: ProjectFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Project name is required.";
    if (!form.startDate) e.startDate = "Start date is required.";
    if (!form.deadline) e.deadline = "Deadline is required.";
    if (form.assignedUserIds.length === 0)
      e.assignedUserIds = "Assign at least one user.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (validate()) onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Project Name <span className="text-red-500">*</span>
        </label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="e.g. Website Redesign"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {errors.name && (
          <p className="mt-1 text-xs text-red-500">{errors.name}</p>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder="What is this project about?"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Status + Priority */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Status
          </label>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as ProjectStatus)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {(
              Object.keys(STATUS_CONFIG) as ProjectStatus[]
            ).map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Priority
          </label>
          <select
            value={form.priority}
            onChange={(e) =>
              set("priority", e.target.value as ProjectPriority)
            }
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            {(
              Object.keys(PRIORITY_CONFIG) as ProjectPriority[]
            ).map((p) => (
              <option key={p} value={p}>
                {PRIORITY_CONFIG[p].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Project dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Start Date <span className="text-red-500">*</span></label>
          <input type="date" required value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {errors.startDate && <p className="mt-1 text-xs text-red-500">{errors.startDate}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Due Date <span className="text-red-500">*</span></label>
          <input type="date" required value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          {errors.deadline && <p className="mt-1 text-xs text-red-500">{errors.deadline}</p>}
        </div>
      </div>

      {/* Assign Users */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          Assign Users <span className="text-red-500">*</span>
        </label>
        <UserSelector
          allUsers={users}
          selectedIds={form.assignedUserIds}
          onChange={(ids) => set("assignedUserIds", ids)}
        />
        {errors.assignedUserIds && (
          <p className="mt-1 text-xs text-red-500">{errors.assignedUserIds}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Modal wrapper
// ─────────────────────────────────────────────────────────────────────────────

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* panel */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Confirm Delete dialog
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDelete({
  projectName,
  onConfirm,
  onCancel,
  error,
}: {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  error?: string;
}) {
  return (
    <Modal title="Delete Project" onClose={onCancel}>
      <div className="text-center space-y-4">
        {error && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="text-5xl">🗑️</div>
        <p className="text-zinc-700 text-sm">
          Are you sure you want to delete{" "}
          <span className="font-semibold">"{projectName}"</span>?
          <br />
          <span className="text-red-500 text-xs">
            This action cannot be undone.
          </span>
        </p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Project Card
// ─────────────────────────────────────────────────────────────────────────────

function ProjectCard({
  project,
  users,
  onEdit,
  onDelete,
}: {
  project: Project;
  users: User[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const assignedUsers = users.filter((u) =>
    project.assignedUserIds.includes(u.id)
  );
  const overdue =
    project.status !== "completed" && isPast(project.deadline);

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/projects/${encodeURIComponent(project.id)}/tasks`)}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          router.push(`/projects/${encodeURIComponent(project.id)}/tasks`);
        }
      }}
      className="bg-white border border-zinc-200 rounded-2xl p-5 flex flex-col gap-4 hover:shadow-md hover:border-zinc-300 transition-all group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-900 text-base truncate group-hover:text-indigo-700 transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-zinc-500 mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        {/* action buttons */}
        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(event) => { event.stopPropagation(); onEdit(); }}
            title="Edit project"
            className="p-1.5 rounded-lg hover:bg-indigo-50 text-zinc-400 hover:text-indigo-600 transition-colors text-sm"
          >
            ✏️
          </button>
          <button
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
            title="Delete project"
            className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors text-sm"
          >
            🗑️
          </button>
        </div>
      </div>

      <p className="text-xs font-medium text-indigo-600 group-hover:text-indigo-700">Open project tasks →</p>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={project.status} />
        <PriorityBadge priority={project.priority} />
      </div>

      {/* Deadline */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span>📅</span>
        <span className={overdue ? "text-red-500 font-medium" : ""}>
          {formatDate(project.deadline)}
          {overdue && " · Overdue"}
        </span>
      </div>

      {/* Assigned users */}
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {assignedUsers.slice(0, 5).map((u) => (
            <Avatar key={u.id} user={u} size="sm" />
          ))}
          {assignedUsers.length > 5 && (
            <div className="w-7 h-7 rounded-full bg-zinc-200 ring-2 ring-white flex items-center justify-center text-xs text-zinc-600 font-medium">
              +{assignedUsers.length - 5}
            </div>
          )}
        </div>
        <span className="text-xs text-zinc-400">
          {assignedUsers.length} member{assignedUsers.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Filter + Search bar
// ─────────────────────────────────────────────────────────────────────────────

function FilterBar({
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  priorityFilter,
  onPriorityFilter,
}: {
  search: string;
  onSearch: (v: string) => void;
  statusFilter: ProjectStatus | "all";
  onStatusFilter: (v: ProjectStatus | "all") => void;
  priorityFilter: ProjectPriority | "all";
  onPriorityFilter: (v: ProjectPriority | "all") => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative flex-1 min-w-48">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">
          🔍
        </span>
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search projects…"
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
        />
      </div>

      {/* Status filter */}
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilter(e.target.value as ProjectStatus | "all")}
        className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      >
        <option value="all">All Statuses</option>
        {(Object.keys(STATUS_CONFIG) as ProjectStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_CONFIG[s].label}
          </option>
        ))}
      </select>

      {/* Priority filter */}
      <select
        value={priorityFilter}
        onChange={(e) =>
          onPriorityFilter(e.target.value as ProjectPriority | "all")
        }
        className="rounded-xl border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
      >
        <option value="all">All Priorities</option>
        {(Object.keys(PRIORITY_CONFIG) as ProjectPriority[]).map((p) => (
          <option key={p} value={p}>
            {PRIORITY_CONFIG[p].label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stats bar
// ─────────────────────────────────────────────────────────────────────────────

function StatsBar({ projects }: { projects: Project[] }) {
  const counts = useMemo(() => {
    const c: Record<ProjectStatus, number> = {
      planning: 0,
      "in-progress": 0,
      "on-hold": 0,
      completed: 0,
    };
    projects.forEach((p) => c[p.status]++);
    return c;
  }, [projects]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {(Object.keys(STATUS_CONFIG) as ProjectStatus[]).map((s) => (
        <div
          key={s}
          className="bg-white border border-zinc-200 rounded-xl px-4 py-3"
        >
          <p className="text-2xl font-bold text-zinc-900">{counts[s]}</p>
          <p className={`text-xs font-medium mt-0.5 ${STATUS_CONFIG[s].color.split(" ")[1]}`}>
            {STATUS_CONFIG[s].label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page (exported — used by Next.js page.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export function ProjectsPage({
  initialProjects,
  initialSearch,
  loadError,
  users,
  usersLoadError,
}: {
  initialProjects: Project[];
  initialSearch: string;
  loadError: boolean;
  users: User[];
  usersLoadError: boolean;
}) {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const router = useRouter();

  // UI state
  const [showCreate, setShowCreate] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [mutationError, setMutationError] = useState("");
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState(initialSearch ?? "");

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  useEffect(() => {
    setSearch(initialSearch ?? "");
  }, [initialSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const query = (typeof search === "string" ? search : "").trim();
      const currentName = new URLSearchParams(window.location.search).get("name") ?? "";
      if (query === currentName) return;

      const href = query ? `/projects?name=${encodeURIComponent(query)}` : "/projects";
      router.replace(href);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [router, search]);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<ProjectPriority | "all">("all");

  // ── CRUD handlers ────────────────────────────────────────────────────────

  async function handleCreate(data: {
    name: string;
    description: string;
    status: ProjectStatus;
    priority: ProjectPriority;
    startDate: string;
    deadline: string;
    assignedUserIds: string[];
  }) {
    setMutationError(""); setSaving(true);
    try {
      await createProject(data);
      setShowCreate(false);
      router.refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Could not create project.");
    } finally { setSaving(false); }
  }

  async function handleUpdate(data: {
    name: string;
    description: string;
    status: ProjectStatus;
    priority: ProjectPriority;
    startDate: string;
    deadline: string;
    assignedUserIds: string[];
  }) {
    if (!editProject) return;
    setMutationError(""); setSaving(true);
    try {
      await updateProject(editProject.id, data);
      setEditProject(null); router.refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Could not update project.");
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteProject) return;
    setMutationError(""); setSaving(true);
    try {
      await removeProject(deleteProject.id);
      setProjects((p) => p.filter((pr) => pr.id !== deleteProject.id));
      setDeleteProject(null); router.refresh();
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : "Could not delete project.");
    } finally { setSaving(false); }
  }

  // ── Filtered list ────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      const matchPriority =
        priorityFilter === "all" || p.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [projects, search, statusFilter, priorityFilter]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      {/* ── Top nav ── */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-indigo-600 text-xl">▣</span>
            <span className="font-bold text-zinc-900 text-base">Flowboard</span>
            <span className="text-zinc-300 mx-1">/</span>
            <span className="text-zinc-600 text-sm font-medium">Projects</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/compress-video" className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-50">
              Compress video
            </Link>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
            >
              <span>+</span> New Project
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {mutationError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{mutationError}</p>}
        {loadError && (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Projects could not be loaded. Check that the projects API is running and try again.
          </p>
        )}
        {usersLoadError && (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Team members couldn’t be loaded, so project assignments are unavailable. Check the users API and refresh.
          </p>
        )}

        {/* ── Stats ── */}
        <StatsBar projects={projects} />

        {/* ── Filter bar ── */}
        <FilterBar
          search={search}
          onSearch={setSearch}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          priorityFilter={priorityFilter}
          onPriorityFilter={setPriorityFilter}
        />

        {/* ── Project grid ── */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-zinc-400">
            <p className="text-5xl mb-3">🗂️</p>
            <p className="font-medium text-zinc-600">No projects found</p>
            <p className="text-sm mt-1">
              {search || statusFilter !== "all" || priorityFilter !== "all"
                ? "Try adjusting your filters."
                : "Click '+ New Project' to create your first project."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                users={users}
                onEdit={() => setEditProject(project)}
                onDelete={() => setDeleteProject(project)}
              />
            ))}
          </div>
        )}

        {/* ── Result count ── */}
        {filtered.length > 0 && (
          <p className="text-xs text-zinc-400 text-right">
            Showing {filtered.length} of {projects.length} projects
          </p>
        )}
      </main>

      {/* ── Create modal ── */}
      {showCreate && (
        <Modal title="Create New Project" onClose={() => setShowCreate(false)}>
          <ProjectForm
            initial={{
              name: "",
              description: "",
              status: "planning",
              priority: "medium",
              startDate: new Date().toISOString().slice(0, 10),
              deadline: "",
              assignedUserIds: [],
            }}
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            submitLabel={saving ? "Creating…" : "Create Project"}
            error={mutationError}
            users={users}
          />
        </Modal>
      )}

      {/* ── Edit modal ── */}
      {editProject && (
        <Modal
          title="Edit Project"
          onClose={() => setEditProject(null)}
        >
          <ProjectForm
            initial={{
              name: editProject.name,
              description: editProject.description,
              status: editProject.status,
              priority: editProject.priority,
              startDate: editProject.startDate ?? "",
              deadline: editProject.deadline,
              assignedUserIds: editProject.assignedUserIds,
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditProject(null)}
            submitLabel={saving ? "Saving…" : "Save Changes"}
            error={mutationError}
            users={users}
          />
        </Modal>
      )}

      {/* ── Delete confirm ── */}
      {deleteProject && (
        <ConfirmDelete
          projectName={deleteProject.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteProject(null)}
          error={mutationError}
        />
      )}
    </div>
  );
}
