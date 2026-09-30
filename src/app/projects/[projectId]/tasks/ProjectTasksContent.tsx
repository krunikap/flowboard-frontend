"use client";

import { useState } from "react";
import { CreateTaskForm, TaskList } from "@/app/components";
import type { Task } from "@/lib/store";
import type { User } from "@/app/projects/types";

export function ProjectTasksContent({
  projectId,
  tasks,
  users,
}: {
  projectId: string;
  tasks: Task[];
  users: User[];
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-700">Tasks for this project</h2>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            + Add task
          </button>
        )}
      </div>

      {showForm && (
        <div className="mb-6">
          <CreateTaskForm
            users={users}
            projectId={projectId}
            onCancel={() => setShowForm(false)}
            onCreated={() => setShowForm(false)}
          />
        </div>
      )}

      <TaskList tasks={tasks} users={users} projectId={projectId} />
    </section>
  );
}
