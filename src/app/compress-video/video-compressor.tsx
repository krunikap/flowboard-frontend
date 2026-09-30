"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useVideoProcessing } from "@/app/video-processing-provider";

type VideoResult = { id: string; operation: VideoOperation; url: string; fileName: string };
type ProcessingUpdate = {
  status?: string;
  progress?: number;
  message?: string;
  outputPath?: string;
  outputUrl?: string;
  compressedVideoUrl?: string;
  videoUrl?: string;
  url?: string;
  fileName?: string;
};
type VideoOperation = "compress" | "convert" | "extractAudio";
type VideoFormat = "mp4" | "mov" | "mkv" | "webm" | "avi";
const VIDEO_FORMATS: VideoFormat[] = ["mp4", "mov", "mkv", "webm", "avi"];

const OPERATIONS: { id: VideoOperation; title: string; description: string }[] = [
  { id: "compress", title: "Compress video", description: "Reduce the file size" },
  { id: "convert", title: "Convert video", description: "Change the video format" },
  { id: "extractAudio", title: "Extract audio", description: "Save the audio track" },
];

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function VideoCompressor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const resultUrlRefs = useRef<string[]>([]);
  const { job, startJob } = useVideoProcessing();
  const [file, setFile] = useState<File | null>(null);
  const [operation, setOperation] = useState<VideoOperation>("compress");
  const [format, setFormat] = useState<VideoFormat>("mp4");
  const [results, setResults] = useState<VideoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [processingStatus, setProcessingStatus] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    resultUrlRefs.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!job) return;
    setProcessingStatus(job.status);
    setProgress(job.progress);
    const active = ["queued", "queue", "in queue", "in_queue", "waiting", "processing", "in progress", "in_progress", "in-progress", "reconnecting"].includes(job.status.replaceAll("_", " "));
    setBusy(active);
    if (job.status === "failed") setError(job.message ?? "Video processing failed.");
    if (job.status === "completed" && job.resultUrl) {
      setProgress(100);
      setResults((current) => current.some((result) => result.id === job.id) ? current : [{
        id: job.id,
        operation: job.operation,
        url: job.resultUrl as string,
        fileName: job.fileName,
      }, ...current]);
    }
  }, [job]);

  function chooseFile(next: File | null) {
    setError("");
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    sourceUrlRef.current = next ? URL.createObjectURL(next) : null;
    setFile(next);
  }

  async function compress() {
    if (!file) return;
    setBusy(true);
    setError("");
    setProcessingStatus("");
    setProgress(0);
    let acceptedJob = false;

    try {
      const body = new FormData();
      body.append("video", file);
      body.append("operation", operation);
      if (operation === "convert") body.append("targetFormat", format);
      const response = await fetch("/api/compress-video", { method: "POST", body });
      if (!response.ok) {
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          const parsed = await response.json() as { error?: string; message?: string };
          throw new Error(parsed.error ?? parsed.message ?? "Video compression failed.");
        }
        throw new Error((await response.text()) || "Video compression failed.");
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const payload = await response.json() as ProcessingUpdate & { success?: boolean; statusUrl?: string; id?: string };
        if (payload.success === false) throw new Error(payload.message ?? "Video processing failed.");

        if (response.status === 202) {
          if (!payload.statusUrl) throw new Error("The processing service accepted the upload but did not return a status URL.");
          startJob(payload.statusUrl, operation, file.name, payload.status, 0);
          acceptedJob = true;
          return;
        }

        const url = payload.outputUrl ?? payload.compressedVideoUrl ?? payload.videoUrl ?? payload.url;
        if (!url) throw new Error(payload.message ?? "The API response did not include an output video URL.");
        const outputName = payload.outputPath?.split("/").pop();
        setResults((current) => [{ id: crypto.randomUUID(), operation, url, fileName: payload.fileName ?? outputName ?? `${operation}-${file.name}` }, ...current]);
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        resultUrlRefs.current.push(url);
        setResults((current) => [{ id: crypto.randomUUID(), operation, url, fileName: `${operation}-${file.name}` }, ...current]);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not compress this video. Please try again.");
      setProcessingStatus("failed");
    } finally {
      if (!acceptedJob) setBusy(false);
    }
  }

  function clear() {
    chooseFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href="/compress-video" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">← Back to videos</Link>
        <header className="mt-8 mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Media tools</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">Choose a video operation</h1>
          <p className="mt-3 max-w-2xl text-zinc-600">Choose what to do, upload a video, and preview or download the result.</p>
        </header>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
          <fieldset>
            <legend className="text-sm font-semibold text-zinc-900">Operation</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {OPERATIONS.map((item) => (
                <label key={item.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition ${operation === item.id ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-zinc-200 hover:border-zinc-300"}`}>
                  <input type="radio" name="video-operation" value={item.id} checked={operation === item.id} onChange={() => setOperation(item.id)} className="mt-1 accent-indigo-600" />
                  <span><span className="block text-sm font-semibold text-zinc-900">{item.title}</span><span className="mt-1 block text-xs text-zinc-500">{item.description}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          {operation === "convert" && <div className="mt-5 max-w-xs">
            <label htmlFor="video-format" className="block text-sm font-medium text-zinc-700">Convert to</label>
            <select id="video-format" value={format} onChange={(event) => setFormat(event.target.value as VideoFormat)} className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {VIDEO_FORMATS.map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}
            </select>
          </div>}
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><path d="m10 9 5 3-5 3z"/></svg>
            </span>
            <div><h2 className="font-semibold text-zinc-900">Upload video</h2><p className="text-sm text-zinc-500">MP4, MOV, or WebM</p></div>
          </div>

          <input ref={inputRef} type="file" accept="video/*" className="sr-only" aria-label="Choose a video" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
          {!file ? (
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-6 flex min-h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14"/></svg>
              </span>
              <span className="mt-4 font-semibold text-zinc-800">Choose a video to upload</span>
              <span className="mt-1 text-sm text-zinc-500">Select a video file from your device</span>
            </button>
          ) : (
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-800">{file.name}</p><p className="text-xs text-zinc-500">{formatSize(file.size)}</p></div>
                <button type="button" disabled={busy} onClick={() => inputRef.current?.click()} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50">Change video</button>
              </div>
              <video src={sourceUrlRef.current ?? undefined} controls className="max-h-80 w-full rounded-xl bg-black" />
            </div>
          )}

          {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={compress} disabled={!file || busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy ? `${OPERATIONS.find((item) => item.id === operation)?.title ?? "Processing"}…` : OPERATIONS.find((item) => item.id === operation)?.title ?? "Process video"}
            </button>
            {file && <button type="button" onClick={clear} disabled={busy} className="rounded-lg border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Clear</button>}
          </div>
          {processingStatus && <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-4" role="status" aria-live="polite">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium capitalize text-zinc-800">{processingStatus === "waiting" || processingStatus === "queued" ? "Waiting" : processingStatus === "processing" ? "Processing" : processingStatus === "reconnecting" ? "Reconnecting" : processingStatus}</span>
              <span className="tabular-nums text-zinc-600">{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200" role="progressbar" aria-label="Video processing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
              <div className="h-full rounded-full bg-indigo-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>}
        </section>

        {results.length > 0 && <section className="mt-8 space-y-4">
          <div><p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Session history</p><h2 className="mt-1 text-xl font-bold text-zinc-900">Processed files ({results.length})</h2></div>
          {results.map((result) => <article key={result.id} className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-emerald-700">{OPERATIONS.find((item) => item.id === result.operation)?.title} complete</p><h3 className="mt-1 truncate font-semibold text-zinc-900">{result.fileName}</h3></div><a href={result.url} download={result.fileName} target="_blank" rel="noreferrer" className="shrink-0 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Download result</a></div>
            {result.operation === "extractAudio" ? <audio src={result.url} controls preload="metadata" aria-label={`Play extracted audio: ${result.fileName}`} className="mt-5 w-full">Your browser does not support audio playback.</audio> : <video src={result.url} controls preload="metadata" className="mt-5 max-h-96 w-full rounded-xl bg-black" />}
          </article>)}
        </section>}
      </div>
    </main>
  );
}
