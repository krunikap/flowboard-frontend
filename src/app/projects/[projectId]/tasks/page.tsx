import Link from "next/link";
import { api } from "@/lib/api";
import { getTasks } from "@/app/actions";
import { ProjectTasksContent } from "./ProjectTasksContent";
import type { Task } from "@/lib/store";
import { getUsers } from "@/lib/users";
import type { User } from "@/app/projects/types";

type ProjectRow = { id?: string | number; _id?: string | number; name?: string };

function findProjectName(payload: unknown, projectId: string): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const body = payload as Record<string, unknown>;
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(body.projects)
      ? body.projects
      : Array.isArray(body.data)
        ? body.data
        : body.data && typeof body.data === "object" && Array.isArray((body.data as Record<string, unknown>).items)
          ? (body.data as { items: unknown[] }).items
          : [];
  const project = (rows as ProjectRow[]).find((row) => String(row.id ?? row._id) === projectId);
  return project?.name;
}

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let tasks: Task[] = [];
  let users: User[] = [];
  let projectName = `Project ${projectId}`;
  let tasksError = false;
  let usersError = false;

  try {
    tasks = await getTasks(projectId);
  } catch (error) {
    console.warn("Could not load project tasks:", error instanceof Error ? error.message : "Request failed");
    tasksError = true;
  }
  try {
    users = await getUsers();
  } catch (error) {
    console.warn("Users API is unavailable:", error instanceof Error ? error.message : "Request failed");
    usersError = true;
  }
  try {
    const endpoint = process.env.PROJECTS_API_URL ?? "http://localhost:4000/api/v1/projects";
    const { data } = await api.get<unknown>(endpoint);
    projectName = findProjectName(data, projectId) ?? projectName;
  } catch {
    // Tasks remain usable if the project details request fails.
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/projects" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">← All projects</Link>
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-500">Project tasks</p>
            <h1 className="text-2xl font-bold text-zinc-900">{projectName}</h1>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">{tasks.length} tasks</span>
        </header>

        {tasksError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Tasks couldn’t be loaded. Check the tasks API and refresh this page.</p>}
        {usersError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Team members couldn’t be loaded, so task assignments are unavailable.</p>}

        <ProjectTasksContent projectId={projectId} tasks={tasks} users={users} />
      </div>
    </main>
  );
}
