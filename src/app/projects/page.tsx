import type { Project, ProjectPriority, ProjectStatus } from "./types";
import { ProjectsPage } from "./ProjectsPage";
import { api } from "@/lib/api";
import { getUsers } from "@/lib/users";

type ApiProject = {
  id?: string | number;
  _id?: string | number;
  name?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  deadline?: string;
  assignedUserIds?: Array<string | number>;
  teamIds?: Array<string | number>;
  createdAt?: string;
};

const PROJECT_STATUSES: ProjectStatus[] = ["planning", "in-progress", "on-hold", "completed"];
const PROJECT_PRIORITIES: ProjectPriority[] = ["low", "medium", "high"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapProjects(payload: unknown): ApiProject[] {
  if (Array.isArray(payload)) return payload as ApiProject[];
  if (!isRecord(payload)) return [];
  const projects = payload.projects ?? payload.data;
  if (Array.isArray(projects)) return projects as ApiProject[];
  if (isRecord(projects) && Array.isArray(projects.items)) return projects.items as ApiProject[];
  return [];
}

function toProject(project: ApiProject, index: number): Project {
  const status = PROJECT_STATUSES.includes(project.status as ProjectStatus) ? project.status as ProjectStatus : "planning";
  const priority = PROJECT_PRIORITIES.includes(project.priority as ProjectPriority) ? project.priority as ProjectPriority : "medium";
  return {
    id: String(project.id ?? project._id ?? `project-${index + 1}`),
    name: project.name ?? `Project ${index + 1}`,
    description: project.description ?? "",
    status,
    priority,
    startDate: project.startDate ?? "",
    deadline: project.deadline ?? project.dueDate ?? project.startDate ?? "",
    assignedUserIds: (project.assignedUserIds ?? project.teamIds ?? []).map((id) => String(id).replace(/^u/, "")),
    createdAt: project.createdAt ?? "",
  };
}

export const metadata = {
  title: "Projects — Flowboard",
  description: "Manage and assign projects to your team.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ name?: string | string[] }> }) {
  const params = await searchParams;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const endpoint = process.env.PROJECTS_API_URL ?? "http://localhost:4000/api/v1/projects";
  let projects: Project[] = [];
  let loadError = false;
  let users = [] as Awaited<ReturnType<typeof getUsers>>;
  let usersLoadError = false;

  try {
    users = await getUsers();
  } catch (error) {
    console.warn("Users API is unavailable:", error instanceof Error ? error.message : "Request failed");
    usersLoadError = true;
  }

  try {
    const url = new URL(endpoint);
    if (name) url.searchParams.set("name", name);
    else url.searchParams.delete("name");
    const response = await api.get<unknown>(url.toString());
    projects = unwrapProjects(response.data).map(toProject);
  } catch (error) {
    console.error("Failed to load projects from the API:", error);
    loadError = true;
  }

  return <ProjectsPage initialProjects={projects} initialSearch={name ?? ""} loadError={loadError} users={users} usersLoadError={usersLoadError} />;
}
