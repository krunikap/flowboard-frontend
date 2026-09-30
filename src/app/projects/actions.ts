"use server";

import { api } from "@/lib/api";

const endpoint = () =>
  process.env.PROJECTS_API_URL ?? "http://localhost:4000/api/v1/projects";

async function request(path: string, method: "POST" | "PATCH" | "DELETE", body: unknown) {
  const response = await api.request({ url: path, method, data: body });
  return response.data;
}

export async function createProject(data: {
  name: string; description: string; status: string; priority: string; startDate: string;
  deadline: string; assignedUserIds: string[];
}) {
  return request(endpoint(), "POST", {
    name: data.name,
    description: data.description,
    startDate: data.startDate,
    dueDate: data.deadline,
    teamIds: data.assignedUserIds.map((id) => Number(id.replace(/^u/, ""))),
    createdBy: 1,
  });
}

export async function updateProject(id: string, data: {
  name: string; description: string; status: string; priority: string; startDate: string;
  deadline: string; assignedUserIds: string[];
}) {
  return request(`${endpoint()}/${encodeURIComponent(id)}`, "PATCH", {
    name: data.name, description: data.description, startDate: data.startDate, dueDate: data.deadline,
    teamIds: data.assignedUserIds.map((id) => Number(id.replace(/^u/, ""))), updatedBy: 1,
  });
}

export async function removeProject(id: string) {
  return request(`${endpoint()}/${encodeURIComponent(id)}`, "DELETE", { deletedBy: 1 });
}
