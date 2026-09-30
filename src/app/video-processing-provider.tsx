"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type VideoOperation = "compress" | "convert" | "extractAudio";
type ProgressEvent = {
  status?: string;
  progress?: number | string;
  message?: string;
  outputUrl?: string;
  compressedVideoUrl?: string;
  videoUrl?: string;
  url?: string;
  fileName?: string;
};
type ProcessingJob = {
  id: string;
  videoId: string | null;
  statusUrl: string;
  fileName: string;
  operation: VideoOperation;
  status: string;
  progress: number;
  message?: string;
  resultUrl?: string;
};

type VideoProcessingContextValue = {
  job: ProcessingJob | null;
  startJob: (statusUrl: string, operation: VideoOperation, fileName: string, status?: string, progress?: number) => void;
  dismissJob: () => void;
};

const VideoProcessingContext = createContext<VideoProcessingContextValue | null>(null);

function extractProgressUpdate(payload: unknown): ProgressEvent | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  if ("status" in record || "progress" in record) return record as ProgressEvent;
  for (const key of ["video", "data", "result"]) {
    const update = extractProgressUpdate(record[key]);
    if (update) return update;
  }
  return null;
}

function numericProgress(value: number | string | undefined): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : null;
}

function isActive(status: string) {
  return ["queued", "queue", "in queue", "in_queue", "waiting", "processing", "in progress", "in_progress", "in-progress", "reconnecting"].includes(status.toLowerCase().replaceAll("_", " "));
}

function displayStatus(status: string) {
  const normalized = status.toLowerCase().replaceAll("_", " ").replaceAll("-", " ");
  if (["queued", "queue", "in queue", "waiting"].includes(normalized)) return "Waiting";
  if (["processing", "in progress"].includes(normalized)) return "Processing";
  if (normalized === "reconnecting") return "Reconnecting";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function VideoProcessingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [job, setJob] = useState<ProcessingJob | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const eventsRef = useRef<EventSource | null>(null);
  const dismissTimerRef = useRef<number | null>(null);
  const dismissTimerJobRef = useRef<string | null>(null);
  const startJobRef = useRef<VideoProcessingContextValue["startJob"] | null>(null);

  useEffect(() => () => {
    eventsRef.current?.close();
    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
  }, []);

  function startJob(statusUrl: string, operation: VideoOperation, fileName: string, status = "waiting", progress = 0) {
    eventsRef.current?.close();
    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = null;
    dismissTimerJobRef.current = null;
    let videoId: string | null = null;
    try {
      videoId = new URL(statusUrl, window.location.origin).pathname.split("/").filter(Boolean).at(-1) ?? null;
    } catch {
      videoId = null;
    }
    const nextJob: ProcessingJob = {
      id: crypto.randomUUID(),
      videoId,
      statusUrl,
      fileName,
      operation,
      status: status.toLowerCase(),
      progress: Math.max(0, Math.min(100, progress)),
    };
    setJob(nextJob);

    let events: EventSource | null = null;
    const applyUpdate = (update: ProgressEvent) => {
      const nextStatus = update.status?.toLowerCase();
      const resultUrl = update.outputUrl ?? update.compressedVideoUrl ?? update.videoUrl ?? update.url;
      const nextProgress = numericProgress(update.progress);
      const terminal = nextStatus === "completed" || nextStatus === "failed";
      const refreshList = nextStatus === "completed" || nextProgress === 100;

      setJob((current) => {
        if (current?.id !== nextJob.id || current.status === "completed" || current.status === "failed") return current;
        return {
          ...current,
          status: nextStatus ?? current.status,
          progress: nextStatus === "completed" ? 100 : nextProgress === null ? current.progress : nextProgress,
          message: update.message ?? current.message,
          resultUrl: resultUrl ?? current.resultUrl,
          fileName: update.fileName ?? current.fileName,
        };
      });

      if (terminal) {
        events?.close();
        if (eventsRef.current === events) eventsRef.current = null;
      }
      if (refreshList) {
        router.refresh();
        if (dismissTimerJobRef.current !== nextJob.id) {
          dismissTimerJobRef.current = nextJob.id;
          dismissTimerRef.current = window.setTimeout(() => {
            eventsRef.current?.close();
            eventsRef.current = null;
            setJob((current) => current?.id === nextJob.id ? null : current);
            dismissTimerRef.current = null;
            dismissTimerJobRef.current = null;
          }, 10_000);
        }
      }
    };

    events = new EventSource(`${statusUrl.replace(/\/$/, "")}/events`);
    eventsRef.current = events;
    events.addEventListener("progress", (event) => {
      let update: ProgressEvent | null;
      try {
        update = extractProgressUpdate(JSON.parse((event as MessageEvent<string>).data) as unknown);
      } catch {
        return;
      }
      if (update) applyUpdate(update);
    });
    events.onerror = () => {
      setJob((current) => current?.id === nextJob.id && isActive(current.status)
        ? { ...current, status: "reconnecting" }
        : current);
    };
  }

  startJobRef.current = startJob;

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("flowboard.video-processing-job");
      if (stored) {
        const saved = JSON.parse(stored) as Partial<ProcessingJob>;
        if (
          typeof saved.statusUrl === "string" &&
          typeof saved.fileName === "string" &&
          (saved.operation === "compress" || saved.operation === "convert" || saved.operation === "extractAudio")
        ) {
          if (isActive(saved.status ?? "")) {
            startJobRef.current?.(saved.statusUrl, saved.operation, saved.fileName, saved.status, numericProgress(saved.progress) ?? 0);
          } else if (typeof saved.status === "string") {
            setJob({
              id: typeof saved.id === "string" ? saved.id : crypto.randomUUID(),
              videoId: typeof saved.videoId === "string" ? saved.videoId : null,
              statusUrl: saved.statusUrl,
              fileName: saved.fileName,
              operation: saved.operation,
              status: saved.status,
              progress: numericProgress(saved.progress) ?? 0,
              message: typeof saved.message === "string" ? saved.message : undefined,
              resultUrl: typeof saved.resultUrl === "string" ? saved.resultUrl : undefined,
            });
          }
        }
      }
    } catch {
      sessionStorage.removeItem("flowboard.video-processing-job");
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (job) sessionStorage.setItem("flowboard.video-processing-job", JSON.stringify(job));
    else sessionStorage.removeItem("flowboard.video-processing-job");
  }, [job, storageReady]);

  function dismissJob() {
    eventsRef.current?.close();
    eventsRef.current = null;
    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = null;
    dismissTimerJobRef.current = null;
    setJob(null);
  }

  return (
    <VideoProcessingContext.Provider value={{ job, startJob, dismissJob }}>
      {children}
      {job && <aside className="fixed bottom-5 left-5 z-[100] w-[min(22rem,calc(100vw-2.5rem))] rounded-xl border border-zinc-200 bg-white p-4 shadow-xl" role="status" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Video processing</p>
            <p className="mt-1 truncate text-sm font-medium text-zinc-900" title={job.fileName}>{job.fileName}</p>
          </div>
          {!isActive(job.status) && <button type="button" onClick={dismissJob} aria-label="Dismiss video processing status" className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100">×</button>}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-700">{displayStatus(job.status)}</span>
          <span className="tabular-nums text-zinc-500">{job.progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-label="Video processing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.progress}>
          <div className={`h-full rounded-full transition-[width] duration-500 ${job.status === "failed" ? "bg-red-500" : job.status === "completed" ? "bg-emerald-500" : "bg-indigo-600"}`} style={{ width: `${job.progress}%` }} />
        </div>
        {job.status === "failed" && job.message && <p className="mt-2 text-xs text-red-700">{job.message}</p>}
      </aside>}
    </VideoProcessingContext.Provider>
  );
}

export function useVideoProcessing() {
  const value = useContext(VideoProcessingContext);
  if (!value) throw new Error("useVideoProcessing must be used within VideoProcessingProvider");
  return value;
}
