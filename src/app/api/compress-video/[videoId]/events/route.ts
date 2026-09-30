export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await context.params;
  const processEndpoint = process.env.COMPRESS_VIDEO_API_URL ?? "http://localhost:4000/api/videos/process";

  try {
    const backendOrigin = new URL(processEndpoint).origin;
    const eventUrl = new URL(`/api/videos/${encodeURIComponent(videoId)}/events`, backendOrigin);
    const upstream = await fetch(eventUrl, {
      headers: { Accept: "text/event-stream" },
      signal: request.signal,
      cache: "no-store",
    });
    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    headers.set("cache-control", "no-cache, no-transform");
    headers.set("x-accel-buffering", "no");

    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    console.error("Video processing event stream request failed:", error);
    return Response.json({ error: "Could not connect to the video processing event stream." }, { status: 502 });
  }
}
