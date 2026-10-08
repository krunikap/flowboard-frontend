const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export type DocumentRecord = { id: number; user_id: number; name: string; file_name: string; file_size: number; mime_type: string; status: string; progress: number; stage: string; error_message?: string | null; created_at: string; updated_at: string };
export type ChatSession = { id: number; user_id: number; document_id: number; title: string; created_at?: string; updated_at?: string };
export type ChatMessage = { id: number; session_id: number; role: string; content: string; created_at?: string };
export type ProgressEvent = { document_id: number; status: string; stage: string; progress: number; error_message?: string | null };
export function apiUrl(path: string) { return `${API_URL}${path}`; }
export function authHeaders(token: string) { return { Authorization: `Bearer ${token}` }; }
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
    throw new Error(body?.detail ?? body?.message ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export async function listDocuments(token: string) { return checked<DocumentRecord[]>(await fetch(apiUrl("/documents/?skip=0&limit=100"), { headers: authHeaders(token) })); }
export async function getDocument(token: string, id: number) { return checked<DocumentRecord>(await fetch(apiUrl(`/documents/${id}`), { headers: authHeaders(token) })); }
export async function uploadDocument(token: string, file: File, name: string, onProgress: (percent: number) => void) {
  return new Promise<DocumentRecord>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/documents/"));
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error("Could not reach the API server."));
    xhr.onload = () => {
      if (xhr.status === 401) redirectToLogin();
      if (xhr.status < 200 || xhr.status >= 300) { try { reject(new Error(JSON.parse(xhr.responseText).detail ?? `Upload failed (${xhr.status}).`)); } catch { reject(new Error(`Upload failed (${xhr.status}).`)); } return; }
      try { resolve(JSON.parse(xhr.responseText) as DocumentRecord); } catch { reject(new Error("The API returned an invalid document response.")); }
    };
    const form = new FormData(); form.append("name", name); form.append("file", file); xhr.send(form);
  });
}
export async function renameDocument(token: string, id: number, name: string) { return checked<DocumentRecord>(await fetch(apiUrl(`/documents/${id}`), { method: "PATCH", headers: { ...authHeaders(token), "Content-Type": "application/json" }, body: JSON.stringify({ name }) })); }
export async function deleteDocument(token: string, id: number) { return checked<void>(await fetch(apiUrl(`/documents/${id}`), { method: "DELETE", headers: authHeaders(token) })); }
export async function listSessions(token: string) { return checked<ChatSession[]>(await fetch(apiUrl("/chats/sessions?skip=0&limit=100"), { headers: authHeaders(token) })); }
export async function createSession(token: string, userId: number, documentId: number, title: string) { return checked<ChatSession>(await fetch(apiUrl("/chats/sessions"), { method: "POST", headers: { ...authHeaders(token), "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, document_id: documentId, title }) })); }
export async function getSession(token: string, id: number) { return checked<ChatSession>(await fetch(apiUrl(`/chats/sessions/${id}`), { headers: authHeaders(token) })); }
export async function deleteSession(token: string, id: number) { return checked<void>(await fetch(apiUrl(`/chats/sessions/${id}`), { method: "DELETE", headers: authHeaders(token) })); }
export async function listMessages(token: string, sessionId: number) { return checked<ChatMessage[]>(await fetch(apiUrl(`/chats/sessions/${sessionId}/messages?skip=0&limit=100`), { headers: authHeaders(token) })); }
export async function addMessage(token: string, sessionId: number, content: string) { return checked<ChatMessage>(await fetch(apiUrl(`/chats/sessions/${sessionId}/messages`), { method: "POST", headers: { ...authHeaders(token), "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId, role: "user", content }) })); }
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
