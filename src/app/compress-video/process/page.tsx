import { VideoCompressor } from "../video-compressor";

export const metadata = {
  title: "Process video — Flowboard",
  description: "Upload and process a video.",
};

export default function ProcessVideoPage() {
  return <VideoCompressor />;
}
