"use client";

import { useRef, useState, useTransition } from "react";
import { createTask, updateTask, toggleTask, deleteTask } from "@/app/actions";
import type { Task } from "@/lib/store";
import type { User } from "@/app/projects/types";

// ─── Create Form ──────────────────────────────────────────────────────────────

function AssigneeSelector({ users, selectedIds = [] }: { users: User[]; selectedIds?: string[] }) {
  if (users.length === 0) return <p className="text-xs text-zinc-500">No team members available.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border border-zinc-200 p-3 max-h-36 overflow-y-auto">
      {users.map((user) => (
        <label key={user.id} className="flex items-center gap-2 text-sm text-zinc-700">
          <input type="checkbox" name="assigneeIds" value={user.id} defaultChecked={selectedIds.includes(user.id)} className="accent-indigo-600" />
          <span className="truncate">{user.name}</span>
        </label>
      ))}
    </div>
  );
}

export function CreateTaskForm({ users, projectId, onCancel, onCreated }: { users: User[]; projectId?: string; onCancel?: () => void; onCreated?: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await createTask(formData);
        formRef.current?.reset();
        onCreated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <form
      ref={formRef}
      action={handleSubmit}
      className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-zinc-800">➕ Add New Task</h2>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="new-title">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          id="new-title"
          name="title"
          required
          placeholder="e.g. Buy groceries"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {projectId ? (
          <input type="hidden" name="projectId" value={projectId} />
        ) : (
          <label className="text-sm text-zinc-700">Project ID<input name="projectId" type="number" required className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
        )}
        <label className="text-sm text-zinc-700">Start date<input name="startDate" type="date" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
        <label className="text-sm text-zinc-700">Due date<input name="dueDate" type="date" className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2" /></label>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-zinc-700">Assign team members</p>
        <AssigneeSelector users={users} />
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-zinc-700" htmlFor="new-desc">
          Description
        </label>
        <textarea
          id="new-desc"
          name="description"
          rows={2}
          placeholder="Optional details…"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
        />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {isPending ? "Adding…" : "Add Task"}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>}
      </div>
    </form>
  );
}

// ─── Task Card (read + inline edit + delete + toggle) ─────────────────────────

export function TaskCard({ task, users, projectId }: { task: Task; users: User[]; projectId?: string }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: (fd: FormData) => Promise<void>, formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await action(formData);
        setEditing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border p-5 space-y-3 transition-opacity ${
        isPending ? "opacity-50 pointer-events-none" : ""
      } ${task.done ? "border-green-200" : "border-zinc-200"}`}
    >
      {!editing ? (
        // ── READ view ──────────────────────────────────────────────────────────
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              {/* Toggle done */}
              <form
                action={(fd) => run(toggleTask, fd)}
                className="mt-0.5 shrink-0"
              >
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="done" value={String(task.done)} />
                <input type="hidden" name="projectId" value={projectId ?? task.projectId} />
                <button
                  type="submit"
                  title={task.done ? "Mark as undone" : "Mark as done"}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    task.done
                      ? "bg-green-500 border-green-500 text-white"
                      : "border-zinc-400 hover:border-indigo-500"
                  }`}
                >
                  {task.done && (
                    <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
                      <path d="M1 6l3.5 3.5L11 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </form>

              <div className="min-w-0">
                <p
                  className={`font-semibold text-zinc-900 truncate ${
                    task.done ? "line-through text-zinc-400" : ""
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-sm text-zinc-500 mt-0.5 line-clamp-2">
                    {task.description}
                  </p>
                )}
              </div>
            </div>

            {/* Edit / Delete buttons */}
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
              >
                Edit
              </button>
              <form action={(fd) => run(deleteTask, fd)}>
                <input type="hidden" name="id" value={task.id} />
                <input type="hidden" name="projectId" value={projectId ?? task.projectId} />
                <button
                  type="submit"
                  className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>

          <p className="text-xs text-zinc-400">
            {new Date(task.createdAt).toLocaleString()} ·{" "}
            <span
              className={`font-medium ${
                task.done ? "text-green-500" : "text-amber-500"
              }`}
            >
              {task.done ? "Done" : "Pending"}
            </span>
          </p>
        </div>
      ) : (
        // ── EDIT (Update) view ────────────────────────────────────────────────
        <form
          action={(fd) => run(updateTask, fd)}
          className="space-y-3"
        >
          <h3 className="text-sm font-semibold text-zinc-700">✏️ Edit Task</h3>

          <input type="hidden" name="id" value={task.id} />
          <input type="hidden" name="done" value={String(task.done)} />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-600">Title *</label>
            <input
              name="title"
              required
              defaultValue={task.title}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {projectId ? (
              <input type="hidden" name="projectId" value={projectId} />
            ) : (
              <label className="text-xs text-zinc-600">Project ID<input name="projectId" type="number" required defaultValue={task.projectId} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" /></label>
            )}
            <label className="text-xs text-zinc-600">Start date<input name="startDate" type="date" defaultValue={task.startDate.slice(0, 10)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" /></label>
            <label className="text-xs text-zinc-600">Due date<input name="dueDate" type="date" defaultValue={task.dueDate.slice(0, 10)} className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" /></label>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-600">Assign team members</p>
            <AssigneeSelector users={users} selectedIds={task.assigneeIds} />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-600">Description</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={task.description}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setError(null); }}
              className="flex-1 border border-zinc-300 hover:bg-zinc-50 text-zinc-700 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─── Task List ─────────────────────────────────────────────────────────────────

export function TaskList({ tasks, users, projectId }: { tasks: Task[]; users: User[]; projectId?: string }) {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p className="text-4xl mb-2">📭</p>
        <p className="text-sm">No tasks yet. Add one above!</p>
      </div>
    );
  }

  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
            Pending ({pending.length})
          </h3>
          <div className="space-y-3">
            {pending.map((t) => <TaskCard key={t.id} task={t} users={users} projectId={projectId} />)}
          </div>
        </section>
      )}
      {done.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-green-400 mb-3">
            Completed ({done.length})
          </h3>
          <div className="space-y-3">
            {done.map((t) => <TaskCard key={t.id} task={t} users={users} projectId={projectId} />)}
          </div>
        </section>
      )}
    </div>
  );
}
