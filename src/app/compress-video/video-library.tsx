"use client";

import { useState } from "react";
import { useVideoProcessing } from "@/app/video-processing-provider";

export type VideoListItem = {
  id: string;
  name: string;
  format: string;
  size: string;
  operation: string;
  status: string;
  progress: number | null;
  added: string;
  url: string | null;
  details: {
    originalName: string;
    fileName: string;
    filePath: string;
    fileSize: string;
    format: string;
    targetFormat: string;
    operation: string;
    createdAt: string;
    compression: Array<{ label: string; value: string }>;
  };
};

export function VideoLibrary({ videos }: { videos: VideoListItem[] }) {
  const { job } = useVideoProcessing();
  const [activeVideo, setActiveVideo] = useState<VideoListItem | null>(null);
  const [detailsVideo, setDetailsVideo] = useState<VideoListItem | null>(null);
  const displayVideos = videos.map((video) => job?.videoId === video.id
    ? { ...video, status: job.status, progress: job.progress }
    : video);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th scope="col" className="px-6 py-3 font-semibold">Video</th>
              <th scope="col" className="px-6 py-3 font-semibold">Format</th>
              <th scope="col" className="px-6 py-3 font-semibold">Size</th>
              <th scope="col" className="px-6 py-3 font-semibold">Operation</th>
              <th scope="col" className="px-6 py-3 font-semibold">Status</th>
              <th scope="col" className="px-6 py-3 font-semibold">Added</th>
              <th scope="col" className="px-6 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {displayVideos.map((video) => (
              <tr key={video.id} className="hover:bg-zinc-50/70">
                <td className="max-w-sm px-6 py-4 font-medium text-zinc-900">
                  <div className="max-w-sm">
                    <button type="button" onClick={() => setActiveVideo(video)} disabled={!video.url} className="block max-w-full truncate text-left hover:text-indigo-700 disabled:cursor-default disabled:hover:text-zinc-900" title={video.url ? `Play ${video.name}` : "No video URL available"}>
                      {video.name}
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 text-zinc-600">{video.format}</td>
                <td className="px-6 py-4 text-zinc-600">{video.size}</td>
                <td className="px-6 py-4 capitalize text-zinc-600">{video.operation}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ${video.status === "failed" ? "bg-red-50 text-red-700" : video.status === "completed" ? "bg-emerald-50 text-emerald-700" : ["processing", "in progress", "in_progress", "in-progress"].includes(video.status) ? "bg-indigo-50 text-indigo-700" : ["queued", "queue", "in queue", "in_queue", "waiting"].includes(video.status) ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {video.status.replaceAll("_", " ").replaceAll("-", " ")}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-zinc-600">{video.added}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setDetailsVideo(video)} className="rounded-md px-2 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50">Details</button>
                    {video.url ? (
                      <a href={video.url} download={video.name} target="_blank" rel="noreferrer" aria-label={`Download ${video.name}`} title={`Download ${video.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" /></svg>
                      </a>
                    ) : <span className="px-2 text-zinc-400" title="Download unavailable">—</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {activeVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="presentation" onClick={() => setActiveVideo(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="video-dialog-title" className="w-full max-w-4xl rounded-2xl bg-white p-4 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="video-dialog-title" className="truncate font-semibold text-zinc-900">{activeVideo.name}</h2>
              <button type="button" onClick={() => setActiveVideo(null)} aria-label="Close video player" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">Close</button>
            </div>
            <video key={activeVideo.url} src={activeVideo.url ?? undefined} controls autoPlay playsInline className="max-h-[75vh] w-full rounded-xl bg-black" />
          </section>
        </div>
      )}

      {detailsVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="presentation" onClick={() => setDetailsVideo(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="video-details-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Video details</p><h2 id="video-details-title" className="mt-1 truncate text-lg font-semibold text-zinc-900">{detailsVideo.name}</h2></div>
              <button type="button" onClick={() => setDetailsVideo(null)} aria-label="Close video details" className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100">Close</button>
            </div>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                ["Operation", detailsVideo.details.operation],
                ["Format", detailsVideo.details.format],
                ["Target format", detailsVideo.details.targetFormat],
                ["File size", detailsVideo.details.fileSize],
                ["Original name", detailsVideo.details.originalName],
                ["File name", detailsVideo.details.fileName],
                ["Created", detailsVideo.details.createdAt],
                ["File path", detailsVideo.details.filePath],
              ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt><dd className="mt-1 break-words text-sm text-zinc-900">{value || "—"}</dd></div>)}
            </dl>
            {detailsVideo.details.compression.length > 0 && (
              <div className="mt-6 border-t border-zinc-200 pt-5">
                <h3 className="font-semibold text-zinc-900">Compression</h3>
                <dl className="mt-3 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                  {detailsVideo.details.compression.map((item) => <div key={item.label}><dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{item.label}</dt><dd className="mt-1 text-sm font-medium text-zinc-900">{item.value}</dd></div>)}
                </dl>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
