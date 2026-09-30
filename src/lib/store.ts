// In-memory store — data lives as long as the server process runs.
// This is intentionally simple for learning CRUD. In a real app you'd use a database.

export type Task = {
  id: string;
  title: string;
  description: string;
  done: boolean;
  createdAt: string;
  projectId: string;
  startDate: string;
  dueDate: string;
  assigneeIds: string[];
};

// globalThis keeps this alive across Hot Module Reloads in dev
declare global {
  // eslint-disable-next-line no-var
  var __tasksStore: Map<string, Task> | undefined;
}

export const tasksStore: Map<string, Task> =
  globalThis.__tasksStore ?? (globalThis.__tasksStore = new Map());

// Seed with a couple of example tasks so the page isn't empty on first load
if (tasksStore.size === 0) {
  const seed: Task[] = [
    {
      id: "1",
      title: "Learn Next.js",
      description: "Go through the official docs and build something.",
      done: false,
      createdAt: new Date().toISOString(),
      projectId: "",
      startDate: "",
      dueDate: "",
      assigneeIds: [],
    },
    {
      id: "2",
      title: "Build a CRUD app",
      description: "Practice create, read, update and delete operations.",
      done: false,
      createdAt: new Date().toISOString(),
      projectId: "",
      startDate: "",
      dueDate: "",
      assigneeIds: [],
    },
  ];
  seed.forEach((t) => tasksStore.set(t.id, t));
}

export function getAllTasks(): Task[] {
  return [...tasksStore.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
