"use server";

import { revalidatePath } from "next/cache";
import type { Task } from "@/lib/store";
import { api } from "@/lib/api";

const tasksEndpoint = () => process.env.TASKS_API_URL ?? `${process.env.API_URL ?? "http://localhost:4000"}/api/tasks`;

function unwrap(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const value = payload as Record<string, unknown>;
    const rows = value.tasks ?? value.data;
    if (Array.isArray(rows)) return rows;
    if (rows && typeof rows === "object" && Array.isArray((rows as Record<string, unknown>).items)) return (rows as {items: unknown[]}).items;
  }
  return [];
}

function mapTask(value: unknown, index: number): Task {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    id: String(row.id ?? row._id ?? index),
    title: String(row.name ?? row.title ?? "Untitled task"),
    description: String(row.description ?? ""),
    done: ["done", "completed"].includes(String(row.status ?? "").toLowerCase()),
    createdAt: String(row.createdAt ?? ""),
    projectId: String(row.projectId ?? ""),
    startDate: String(row.startDate ?? ""),
    dueDate: String(row.dueDate ?? ""),
    assigneeIds: Array.isArray(row.assigneeIds) ? row.assigneeIds.map(String) : [],
  };
}

export async function getTasks(projectId?: string): Promise<Task[]> {
  const { data: payload } = await api.get<unknown>(tasksEndpoint(), {
    params: projectId ? { projectId } : undefined,
  });
  return unwrap(payload).map(mapTask);
}

function taskBody(formData: FormData) {
  const assigneeIds = formData.getAll("assigneeIds").flatMap((value) =>
    String(value).split(",").map((id) => Number(id.trim())).filter(Number.isFinite),
  );
  return {
    name: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    projectId: Number(formData.get("projectId")),
    startDate: String(formData.get("startDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    assigneeIds,
  };
}

export async function createTask(formData: FormData) {
  const body = taskBody(formData);
  if (!body.name) throw new Error("Task name is required");
  await api.post(tasksEndpoint(), { ...body, createdBy: 1 });
  revalidatePath("/");
  if (body.projectId) revalidatePath(`/projects/${body.projectId}/tasks`);
}

export async function updateTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const body = taskBody(formData);
  if (!body.name) throw new Error("Task name is required");
  await api.patch(`${tasksEndpoint()}/${encodeURIComponent(id)}`, { ...body, updatedBy: 1 });
  revalidatePath("/");
  if (body.projectId) revalidatePath(`/projects/${body.projectId}/tasks`);
}

export async function toggleTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const completed = formData.get("done") === "true";
  await api.patch(`${tasksEndpoint()}/${encodeURIComponent(id)}`, { status: completed ? "todo" : "completed", updatedBy: 1 });
  revalidatePath("/");
  const projectId = String(formData.get("projectId") ?? "");
  if (projectId) revalidatePath(`/projects/${projectId}/tasks`);
}

export async function deleteTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  await api.delete(`${tasksEndpoint()}/${encodeURIComponent(id)}`, { data: { deletedBy: 1 } });
  revalidatePath("/");
  const projectId = String(formData.get("projectId") ?? "");
  if (projectId) revalidatePath(`/projects/${projectId}/tasks`);
}
