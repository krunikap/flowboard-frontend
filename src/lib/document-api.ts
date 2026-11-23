// AI Document Intelligence API (FastAPI). Every route lives under /api/v1 and JSON responses are
// wrapped as { status, message, data, error }; streaming (SSE) endpoints are not wrapped.
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
type ApiEnvelope<T> = { status: number; message: string; data: T; error: unknown };
export type DocumentRecord = { id: number; user_id: number; name: string; file_name: string; file_size: number; mime_type: string; status: string; progress: number; stage: string; error_message?: string | null; created_at: string; updated_at: string };
export type ChatSession = { id: number; user_id: number; document_id: number; title: string; created_at?: string; updated_at?: string };
export type ChatMessage = { id: number; session_id: number; role: string; content: string; created_at?: string };
export type ChatSource = { chunk_id: number; page_number: number | null; chunk_index: number; excerpt: string };
export type ChatTurn = { user_message: ChatMessage; assistant_message: ChatMessage; answer: string; sources: ChatSource[] };
export type ChatStreamResult = Omit<ChatTurn, "sources"> & { sources: ChatSource[] };
export type ProgressEvent = { document_id: number; status: string; stage: string; progress: number; error_message?: string | null };
export function apiUrl(path: string) { return `${API_URL}${path}`; }
export function authHeaders(token: string) { return { Authorization: `Bearer ${token}` }; }
function apiErrorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const messages = value.map((item) => {
      if (!item || typeof item !== "object") return null;
      const detail = item as { field?: unknown; message?: unknown };
      if (typeof detail.message !== "string") return null;
      return typeof detail.field === "string" && detail.field ? `${detail.field}: ${detail.message}` : detail.message;
    }).filter((item): item is string => Boolean(item));
    if (messages.length) return messages.join(" ");
  }
  if (value && typeof value === "object") {
    const body = value as { message?: unknown; error?: unknown };
    return (Array.isArray(body.error) ? apiErrorMessage(body.error) : null) ?? apiErrorMessage(body.message) ?? apiErrorMessage(body.error);
  }
  return null;
}
function redirectToLogin() {
  try {
    window.localStorage.removeItem("flowboard.auth.token");
    window.localStorage.removeItem("flowboard.auth.user");
  } catch { /* Storage may be disabled. */ }
  if (window.location.pathname !== "/login" && window.location.pathname !== "/register") window.location.assign("/login");
}
async function checked<T>(response: Response): Promise<T> {
  if (response.status === 401) redirectToLogin();
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(apiErrorMessage(body) ?? `Request failed (${response.status}).`);
  }
  const body = await response.json() as ApiEnvelope<T>;
  return body.data;
}
export async function listDocuments(token: string) { return checked<DocumentRecord[]>(await fetch(apiUrl("/documents?skip=0&limit=100"), { headers: authHeaders(token) })); }
export async function getDocument(token: string, id: number) { return checked<DocumentRecord>(await fetch(apiUrl(`/documents/${id}`), { headers: authHeaders(token) })); }
export async function uploadDocument(token: string, file: File, name: string, onProgress: (percent: number) => void) {
  return new Promise<DocumentRecord>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/documents"));
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error("Could not reach the API server."));
    xhr.onload = () => {
      if (xhr.status === 401) redirectToLogin();
      if (xhr.status < 200 || xhr.status >= 300) { try { reject(new Error(apiErrorMessage(JSON.parse(xhr.responseText)) ?? `Upload failed (${xhr.status}).`)); } catch { reject(new Error(`Upload failed (${xhr.status}).`)); } return; }
      try { resolve((JSON.parse(xhr.responseText) as ApiEnvelope<DocumentRecord>).data); } catch { reject(new Error("The API returned an invalid document response.")); }
    };
    const form = new FormData(); form.append("name", name); form.append("file", file); xhr.send(form);
  });
}
export async function renameDocument(token: string, id: number, name: string) { return checked<DocumentRecord>(await fetch(apiUrl(`/documents/${id}`), { method: "PATCH", headers: { ...authHeaders(token), "Content-Type": "application/json" }, body: JSON.stringify({ name }) })); }
export async function deleteDocument(token: string, id: number) { return checked<void>(await fetch(apiUrl(`/documents/${id}`), { method: "DELETE", headers: authHeaders(token) })); }
export async function listSessions(token: string, documentId: number) { return checked<ChatSession[]>(await fetch(apiUrl(`/documents/${documentId}/chat/sessions?skip=0&limit=100`), { headers: authHeaders(token) })); }
export async function createSession(token: string, documentId: number, title: string) { return checked<ChatSession>(await fetch(apiUrl(`/documents/${documentId}/chat/sessions`), { method: "POST", headers: { ...authHeaders(token), "Content-Type": "application/json" }, body: JSON.stringify({ title }) })); }
export async function getSession(token: string, id: number) { return checked<ChatSession>(await fetch(apiUrl(`/chats/sessions/${id}`), { headers: authHeaders(token) })); }
export async function deleteSession(token: string, id: number) { return checked<void>(await fetch(apiUrl(`/chats/sessions/${id}`), { method: "DELETE", headers: authHeaders(token) })); }
export async function listMessages(token: string, sessionId: number) { return checked<ChatMessage[]>(await fetch(apiUrl(`/chat/sessions/${sessionId}/messages?skip=0&limit=100`), { headers: authHeaders(token) })); }
export async function addMessage(token: string, sessionId: number, content: string) { return checked<ChatTurn>(await fetch(apiUrl(`/chat/sessions/${sessionId}/messages`), { method: "POST", headers: { ...authHeaders(token), "Content-Type": "application/json" }, body: JSON.stringify({ content }) })); }
export async function streamMessage(token: string, sessionId: number, content: string, signal: AbortSignal, onChunk: (text: string) => void): Promise<ChatStreamResult> {
  let response: Response;
  try {
    response = await fetch(apiUrl(`/chat/sessions/${sessionId}/messages/stream`), {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ content }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof TypeError) throw new Error("Could not reach the API server.");
    throw error;
  }
  if (response.status === 401) redirectToLogin();
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    throw new Error(apiErrorMessage(body) ?? `Chat request failed (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed: ChatStreamResult | null = null;
  function consume(block: string) {
    let eventName = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    if (!data.length) return;
    let payload: unknown;
    try { payload = JSON.parse(data.join("\n")); }
    catch { throw new Error("The chat stream returned malformed data."); }
    if (eventName === "chunk") {
      if (!payload || typeof payload !== "object" || typeof (payload as { text?: unknown }).text !== "string") throw new Error("The chat stream returned an invalid text chunk.");
      onChunk((payload as { text: string }).text);
    } else if (eventName === "done") {
      const turn = payload as Partial<ChatStreamResult>;
      if (!turn.user_message || !turn.assistant_message || typeof turn.answer !== "string" || !Array.isArray(turn.sources)) throw new Error("The chat stream returned an invalid completion event.");
      completed = turn as ChatStreamResult;
    } else if (eventName === "error") {
      throw new Error(apiErrorMessage(payload) ?? "The chat answer could not be completed.");
    }
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      for (const block of blocks) consume(block);
      if (completed) { await reader.cancel().catch(() => undefined); return completed; }
    }
  } finally {
    if (!completed) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  if (!completed) throw new Error("The chat stream ended before completion. Your answer may be incomplete; retry to continue.");
  return completed;
}
export async function* documentEvents(token: string, documentId: number, signal: AbortSignal): AsyncGenerator<ProgressEvent> {
  const response = await fetch(apiUrl(`/documents/${documentId}/events`), { headers: { ...authHeaders(token), Accept: "text/event-stream" }, signal });
  if (response.status === 401) redirectToLogin();
  if (!response.ok || !response.body) throw new Error("Could not connect to document progress.");
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
  function parseEvent(block: string): ProgressEvent | null {
    const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
    if (!data) return null;
    try { return JSON.parse(data) as ProgressEvent; } catch { return null; }
  }
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) { buffer += decoder.decode(); break; }
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/); buffer = events.pop() ?? "";
      for (const event of events) { const progress = parseEvent(event); if (progress) yield progress; }
    }
    if (buffer.trim()) { const progress = parseEvent(buffer); if (progress) yield progress; }
  } finally { reader.releaseLock(); }
}
