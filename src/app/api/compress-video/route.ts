export const runtime = "nodejs";

export async function POST(request: Request) {
  const endpoint = process.env.COMPRESS_VIDEO_API_URL ?? "http://localhost:4000/api/videos/process";

  try {
    const formData = await request.formData();
    const video = formData.get("video");
    const operation = formData.get("operation");
    const targetFormat = formData.get("targetFormat");
    if (!(video instanceof File)) {
      return Response.json({ error: "Choose a video file to upload." }, { status: 400 });
    }
    if (!video.type.startsWith("video/")) {
      return Response.json({ error: "The uploaded file must be a video." }, { status: 400 });
    }
    if (operation !== "compress" && operation !== "convert" && operation !== "extractAudio") {
      return Response.json({ error: "Choose a valid video operation." }, { status: 400 });
    }
    if (operation === "convert" && !["mp4", "mov", "mkv", "webm", "avi"].includes(String(targetFormat))) {
      return Response.json({ error: "Choose a valid output format." }, { status: 400 });
    }

    const upstreamForm = new FormData();
    upstreamForm.append("video", video, video.name);
    upstreamForm.append("operation", operation);
    if (operation === "convert") upstreamForm.append("targetFormat", String(targetFormat));
    const upstream = await fetch(endpoint, { method: "POST", body: upstreamForm });
    const responseBody = await upstream.arrayBuffer();
    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    const disposition = upstream.headers.get("content-disposition");

    if (contentType?.includes("application/json")) {
      const payload = JSON.parse(new TextDecoder().decode(responseBody)) as {
        success?: boolean;
        message?: string;
        id?: string | number;
        videoId?: string | number;
        jobId?: string | number;
        statusUrl?: string;
        outputPath?: string;
        outputUrl?: string;
        url?: string;
        videoUrl?: string;
      };
      const outputPath = payload.outputPath?.replace(/^\/+/, "");
      const backendOrigin = new URL(endpoint).origin;
      const outputUrl = payload.outputUrl ?? payload.url ?? payload.videoUrl ?? (
        outputPath ? new URL(outputPath.split("/").map(encodeURIComponent).join("/"), backendOrigin).toString() : undefined
      );
      const returnedStatusUrl = payload.statusUrl;
      let statusUrl = returnedStatusUrl;
      if (returnedStatusUrl) {
        const statusId = payload.id ?? payload.videoId ?? payload.jobId ?? (() => {
          try {
            const statusPath = new URL(returnedStatusUrl, backendOrigin).pathname;
            return statusPath.match(/\/api\/videos\/([^/]+)/)?.[1];
          } catch {
            return undefined;
          }
        })();
        if (statusId !== undefined) statusUrl = `/api/compress-video/${encodeURIComponent(String(statusId))}`;
      }
      return Response.json({ ...payload, outputUrl, statusUrl }, { status: upstream.status });
    }

    if (contentType) headers.set("content-type", contentType);
    if (disposition) headers.set("content-disposition", disposition);
    return new Response(responseBody, { status: upstream.status, headers });
  } catch (error) {
    console.error("Video compression API request failed:", error);
    return Response.json({ error: "Could not reach the video compression service." }, { status: 502 });
  }
}
