import { getTasks } from "@/app/actions";
import { CreateTaskForm, TaskList } from "@/app/components";
import type { Task } from "@/lib/store";
import { getUsers } from "@/lib/users";
import type { User } from "@/app/projects/types";

// This is a Server Component — it fetches data on the server and streams it
// to the client. No useEffect, no fetch() on the client.
export default async function Home() {
  let tasks: Task[] = [];
  let loadError = false;
  let users: User[] = [];
  let usersLoadError = false;
  try {
    tasks = await getTasks();
  } catch (error) {
    console.error("Failed to load tasks from the API:", error);
    loadError = true;
  }
  try {
    users = await getUsers();
  } catch (error) {
    console.warn("Users API is unavailable:", error instanceof Error ? error.message : "Request failed");
    usersLoadError = true;
  }

  return (
    <main className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-8">
        {/* ── Header ── */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
            📋 Task Manager
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            A simple CRUD demo built with Next.js Server Actions
          </p>
        </div>

        {/* ── CRUD legend ── */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {(
            [
              { label: "Create", color: "bg-indigo-100 text-indigo-700", emoji: "➕" },
              { label: "Read", color: "bg-blue-100 text-blue-700", emoji: "👁️" },
              { label: "Update", color: "bg-amber-100 text-amber-700", emoji: "✏️" },
              { label: "Delete", color: "bg-red-100 text-red-700", emoji: "🗑️" },
            ] as const
          ).map(({ label, color, emoji }) => (
            <div
              key={label}
              className={`rounded-xl py-2 px-1 text-xs font-semibold ${color}`}
            >
              <div className="text-lg">{emoji}</div>
              {label}
            </div>
          ))}
        </div>

        {/* ── CREATE ── */}
        <CreateTaskForm users={users} />

        {usersLoadError && (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Team members couldn’t be loaded, so task assignments are unavailable. Check the users API and refresh.
          </p>
        )}

        {loadError && (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Tasks couldn’t be loaded right now. Check that the tasks API is available, then refresh this page.
          </p>
        )}

        {/* ── READ + UPDATE + DELETE ── */}
        <section>
          <h2 className="text-sm font-semibold text-zinc-500 mb-4">
            All Tasks ({tasks.length})
          </h2>
          <TaskList tasks={tasks} users={users} />
        </section>
      </div>
    </main>
  );
}
