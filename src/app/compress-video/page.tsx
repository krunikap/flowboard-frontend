import Link from "next/link";
import { api } from "@/lib/api";
import { VideoLibrary, type VideoListItem } from "./video-library";

type VideoRecord = Record<string, unknown>;

function isRecord(value: unknown): value is VideoRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapVideos(payload: unknown): VideoRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (!isRecord(payload)) return [];
  for (const key of ["videos", "data", "items", "results"]) {
    const value = payload[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) {
      for (const nestedKey of ["videos", "items", "results"]) {
        const nested = value[nestedKey];
        if (Array.isArray(nested)) return nested.filter(isRecord);
      }
    }
  }
  return [];
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function formatFileSize(value: unknown) {
  const bytes = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;

  if (!Number.isFinite(bytes) || bytes < 0) return text(value, "—");
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = -1;
  do {
    size /= 1024;
    unitIndex += 1;
  } while (size >= 1024 && unitIndex < units.length - 1);
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function videoDate(video: VideoRecord) {
  const value = video.createdAt ?? video.uploadedAt ?? video.created_at;
  if (typeof value !== "string") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function videoProgress(video: VideoRecord): number | null {
  const value = typeof video.progress === "number"
    ? video.progress
    : typeof video.progress === "string" && video.progress.trim() !== ""
      ? Number(video.progress)
      : Number.NaN;
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function getVideoUrl(video: VideoRecord, backendOrigin: string): string | null {
  const value = video.url ?? video.videoUrl ?? video.fileUrl ?? video.downloadUrl ?? video.outputUrl ?? video.path ?? video.filePath;
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new URL(value, backendOrigin).toString();
  } catch {
    return null;
  }
}

export const metadata = {
  title: "Videos — Flowboard",
  description: "View uploaded videos and start processing a video.",
};

export default async function CompressVideoPage() {
  let videos: VideoListItem[] = [];
  let loadError = false;
  try {
    const endpoint = process.env.VIDEOS_API_URL ?? "http://localhost:4000/api/videos?page=1&limit=50";
    const response = await api.get<unknown>(endpoint);
    const backendOrigin = new URL(endpoint).origin;
    videos = unwrapVideos(response.data).map((video, index) => {
      const name = text(video.originalName ?? video.fileName ?? video.filename ?? video.name ?? video.title, `Video ${index + 1}`);
      const extension = name.includes(".") ? name.split(".").pop()?.toUpperCase() ?? "—" : "—";
      const compression = isRecord(video.compression) ? video.compression : {};
      const compressionDetails: Array<{ label: string; value: string }> = [];
      const compressionFields: Array<[string, unknown, string]> = [
        ["Original size", compression.originalSizeMB, " MB"],
        ["Compressed size", compression.compressedSizeMB, " MB"],
        ["Size saved", compression.sizeSavedMB, " MB"],
        ["Compression", compression.compressionPercent, "%"],
      ];
      compressionFields.forEach(([label, value, suffix]) => {
        if (typeof value === "number" || typeof value === "string") {
          compressionDetails.push({ label, value: `${value}${suffix}` });
        }
      });
      const createdAt = videoDate(video);
      const status = text(video.status ?? video.state ?? video.jobStatus, "—").toLowerCase();
      const progress = videoProgress(video) ?? (["queued", "queue", "in_queue", "waiting", "processing", "in_progress", "in-progress"].includes(status) ? 0 : null);
      return {
        id: text(video.id ?? video._id, `${name}-${index}`),
        name,
        format: text(video.format ?? video.mimeType ?? video.type, extension),
        size: formatFileSize(video.size ?? video.fileSize ?? video.sizeBytes),
        operation: text(video.operation, "—"),
        status,
        progress,
        added: createdAt,
        url: getVideoUrl(video, backendOrigin),
        details: {
          originalName: text(video.originalName, "—"),
          fileName: text(video.fileName, "—"),
          filePath: text(video.filePath, "—"),
          fileSize: formatFileSize(video.fileSize ?? video.size ?? video.sizeBytes),
          format: text(video.format, "—"),
          targetFormat: text(video.targetFormat, "—"),
          operation: text(video.operation, "—"),
          createdAt,
          compression: compressionDetails,
        },
      };
    });
  } catch (error) {
    console.error("Failed to load videos from the API:", error);
    loadError = true;
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Media library</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">Videos</h1>
            <p className="mt-2 text-zinc-600">Browse your videos or start a new processing task.</p>
          </div>
          <Link href="/compress-video/process" className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            Process video
          </Link>
        </header>

        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm" aria-labelledby="video-list-heading">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 sm:px-6">
            <h2 id="video-list-heading" className="font-semibold text-zinc-900">Video list</h2>
            <span className="text-sm text-zinc-500">{videos.length} {videos.length === 1 ? "video" : "videos"}</span>
          </div>
          {loadError ? (
            <p role="alert" className="px-6 py-12 text-center text-sm text-red-700">Videos could not be loaded. Check that the videos API is running and try again.</p>
          ) : videos.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-zinc-500">No videos found.</p>
          ) : <VideoLibrary videos={videos} />}
        </section>
      </div>
    </main>
  );
}
