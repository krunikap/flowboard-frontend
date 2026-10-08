"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/auth-provider";
import { addMessage, ChatMessage, ChatSession, createSession, deleteDocument, deleteSession, DocumentRecord, documentEvents, getDocument, getSession, listDocuments, listMessages, listSessions, renameDocument, uploadDocument } from "@/lib/document-api";

type Upload = { name: string; progress: number; error?: string };
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const dateLabel = (value: string) => new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export default function Home() {
  // Previous entry point, retained for reference:
  // import { redirect } from "next/navigation";
  // export default function Home() { redirect("/projects"); }
  const { user, token, signOut } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const streams = useRef(new Map<number, AbortController>());

  const refresh = useCallback(async () => {
    if (!token) return;
    try { const [docs, chats] = await Promise.all([listDocuments(token), listSessions(token)]); setDocuments(docs); setSessions(chats); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load your workspace."); }
  }, [token]);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!token) return;
    for (const doc of documents) {
      if (!["QUEUED", "PROCESSING"].includes(doc.status) || streams.current.has(doc.id)) continue;
      const controller = new AbortController(); streams.current.set(doc.id, controller);
      void (async () => {
        let finished = false;
        try {
          while (!finished && !controller.signal.aborted) {
            try {
              for await (const event of documentEvents(token, doc.id, controller.signal)) {
                setDocuments((current) => current.map((item) => item.id === doc.id ? { ...item, status: event.status, stage: event.stage, progress: event.progress, error_message: event.error_message } : item));
                if (event.status === "COMPLETED") {
                  setNotice(`${doc.file_name} uploaded successfully.`);
                  setError("");
                  setUpload((current) => current?.name === doc.file_name ? null : current);
                  finished = true;
                  break;
                }
                if (event.status === "FAILED") {
                  setNotice("");
                  setError(event.error_message || `${doc.file_name} processing failed.`);
                  setUpload((current) => current?.name === doc.file_name ? { ...current, error: event.error_message || "Processing failed." } : current);
                  finished = true;
                  break;
                }
              }
            } catch {
              if (controller.signal.aborted) break;
            }
            if (!finished && !controller.signal.aborted) {
              await new Promise<void>((resolve) => {
                const finish = () => { window.clearTimeout(timeout); controller.signal.removeEventListener("abort", finish); resolve(); };
                const timeout = window.setTimeout(finish, 1200);
                controller.signal.addEventListener("abort", finish, { once: true });
              });
            }
          }
        } finally { streams.current.delete(doc.id); }
      })();
    }
  }, [documents, token]);
  useEffect(() => () => { for (const controller of streams.current.values()) controller.abort(); streams.current.clear(); }, []);
  useEffect(() => { if (!token || !selectedSession) { setMessages([]); return; } let alive = true; listMessages(token, selectedSession).then((items) => { if (alive) setMessages(items); }).catch((e) => setError(e instanceof Error ? e.message : "Could not load messages.")); return () => { alive = false; }; }, [token, selectedSession]);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const filteredDocuments = useMemo(() => documents.filter((doc) => `${doc.name} ${doc.file_name}`.toLowerCase().includes(query.toLowerCase())), [documents, query]);
  const activeDocument = documents.find((doc) => doc.id === selectedDocument) ?? null;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file || !token) return;
    setUpload({ name: file.name, progress: 0 }); setError(""); setNotice("");
    try {
      const doc = await uploadDocument(token, file, file.name.replace(/\.[^.]+$/, "") || file.name, (progress) => setUpload({ name: file.name, progress }));
      setDocuments((current) => [doc, ...current]); setSelectedDocument(doc.id); setNotice("Upload complete. Processing has started.");
      window.setTimeout(() => setUpload(null), 1100);
    } catch (e) { const message = e instanceof Error ? e.message : "Upload failed."; setUpload({ name: file.name, progress: 0, error: message }); setError(message); }
    finally { event.target.value = ""; }
  }
  async function rename(doc: DocumentRecord) {
    const name = window.prompt("New document name", doc.name)?.trim(); if (!name || !token || name === doc.name) return;
    try { const updated = await renameDocument(token, doc.id, name); setDocuments((items) => items.map((item) => item.id === doc.id ? updated : item)); setNotice("Document renamed."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not rename document."); }
  }
  async function openDocument(id: number) {
    setSelectedDocument(id);
    if (!token) return;
    try { const latest = await getDocument(token, id); setDocuments((items) => items.map((item) => item.id === id ? latest : item)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load document."); }
  }
  async function openChat(session: ChatSession) {
    setSelectedDocument(session.document_id); setSelectedSession(session.id);
    if (!token) return;
    try { const latest = await getSession(token, session.id); setSessions((items) => items.map((item) => item.id === session.id ? latest : item)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load chat session."); }
  }
  async function removeDocument(doc: DocumentRecord) {
    if (!token || !window.confirm(`Delete “${doc.name}”?`)) return;
    try { await deleteDocument(token, doc.id); setDocuments((items) => items.filter((item) => item.id !== doc.id)); if (selectedDocument === doc.id) setSelectedDocument(null); setNotice("Document deleted."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete document."); }
  }
  async function startChat() {
    if (!token || !user?.id || !activeDocument) return;
    setBusy(true); setError("");
    try { const session = await createSession(token, Number(user.id), activeDocument.id, `Questions about ${activeDocument.name}`); setSessions((items) => [session, ...items]); setSelectedSession(session.id); setNotice("Chat session created. Messages are saved, but AI answers are not available yet."); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not create chat session."); }
    finally { setBusy(false); }
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const content = draft.trim(); if (!content || !token || !selectedSession) return;
    setBusy(true); setError("");
    try { const message = await addMessage(token, selectedSession, content); setMessages((items) => [...items, message]); setDraft(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not save message."); }
    finally { setBusy(false); }
  }
  async function removeChat(session: ChatSession) {
    if (!token || !window.confirm("Delete this chat session and its messages?")) return;
    try { await deleteSession(token, session.id); setSessions((items) => items.filter((item) => item.id !== session.id)); if (selectedSession === session.id) setSelectedSession(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete session."); }
  }

  return <main className="workspace-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">F</span><span>Folio<span className="brand-dot">.</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list"><button className="nav-item active"><span>▤</span> Documents <span className="nav-count">{documents.length}</span></button><a className="nav-item" href="/projects"><span>◈</span> Previous projects</a></nav>
      <div className="sidebar-section"><div className="sidebar-heading">RECENT CHATS <span>{sessions.length}</span></div>
        <div className="chat-list">{sessions.slice(0, 8).map((session) => <div key={session.id} className={`chat-entry ${selectedSession === session.id ? "selected" : ""}`}><button onClick={() => void openChat(session)} title={session.title}>{session.title}</button><button className="chat-delete" aria-label="Delete chat" onClick={() => void removeChat(session)}>×</button></div>)}{!sessions.length && <p className="empty-sidebar">No chats yet</p>}</div>
      </div>
      <div className="sidebar-bottom"><div className="user-badge">{(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}</div><div className="user-info"><strong>{user?.name || "Your account"}</strong><span>{user?.email}</span></div><button onClick={signOut} className="logout-button" aria-label="Sign out" title="Sign out">↗</button></div>
    </aside>
    <section className="main-panel">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Documents</strong></div><div className="top-actions"><span className="api-state"><i /> API connected</span><button className="avatar-button" title={user?.email}>{(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}</button></div></header>
      <div className="content-wrap">
        <div className="page-intro"><div><div className="eyebrow">YOUR KNOWLEDGE LIBRARY</div><h1>Documents</h1><p>Upload, organize, and chat with your files.</p></div><button className="primary-button" onClick={() => fileRef.current?.click()}><span>＋</span> Upload document</button><input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.md,.csv" onChange={handleFiles} /></div>
        {(error || notice) && <div role={error ? "alert" : "status"} className={`toast ${error ? "toast-error" : "toast-success"}`}><span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
        {upload && <div className="upload-card"><div className="file-icon">↑</div><div className="upload-details"><div><strong>{upload.name}</strong><span>{upload.error || (upload.progress < 100 ? `Uploading · ${upload.progress}%` : "Uploaded · starting processing")}</span></div><div className="progress-track"><i style={{ width: `${upload.progress}%` }} /></div></div><span className="upload-percent">{upload.progress}%</span></div>}
        <div className="stats-row"><div className="stat-card"><span className="stat-icon purple">▤</span><div><strong>{documents.length}</strong><span>Total documents</span></div></div><div className="stat-card"><span className="stat-icon green">✓</span><div><strong>{documents.filter((d) => d.status === "COMPLETED").length}</strong><span>Ready to chat</span></div></div><div className="stat-card"><span className="stat-icon amber">◷</span><div><strong>{documents.filter((d) => ["QUEUED", "PROCESSING"].includes(d.status)).length}</strong><span>Processing</span></div></div></div>
        <div className="library-heading"><div><h2>All documents <span>{documents.length}</span></h2><p>Your files and their processing status</p></div><div className="search-field"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" /></div></div>
        {documents.length === 0 ? <div className="empty-state"><div className="empty-art"><span>▤</span><i>＋</i></div><h3>Your library starts here</h3><p>Upload a PDF, DOCX, TXT, Markdown, or CSV file to get started.</p><button className="primary-button" onClick={() => fileRef.current?.click()}>＋ Upload your first document</button></div> : <div className="document-table-wrap"><table className="document-table"><thead><tr><th>NAME</th><th>STATUS</th><th>SIZE</th><th>ADDED</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredDocuments.map((doc) => <tr key={doc.id} className={selectedDocument === doc.id ? "row-selected" : ""} onClick={() => void openDocument(doc.id)}><td><div className="doc-name"><span className="file-tile">{doc.file_name.toLowerCase().endsWith(".pdf") ? "PDF" : doc.file_name.split(".").pop()?.slice(0, 3).toUpperCase() || "FILE"}</span><div><strong>{doc.name}</strong><span>{doc.file_name}</span></div></div></td><td><span className={`status-pill status-${doc.status.toLowerCase()}`}><i />{doc.status === "PROCESSING" ? `${doc.stage || "Processing"} · ${doc.progress}%` : doc.status}</span>{doc.error_message && <span className="processing-error">{doc.error_message}</span>}</td><td className="muted-cell">{formatBytes(doc.file_size)}</td><td className="muted-cell">{dateLabel(doc.created_at)}</td><td><div className="row-actions"><button onClick={(e) => { e.stopPropagation(); void rename(doc); }} aria-label="Rename document" title="Rename">✎</button><button onClick={(e) => { e.stopPropagation(); void removeDocument(doc); }} aria-label="Delete document" title="Delete">⌫</button></div></td></tr>)}</tbody></table>{filteredDocuments.length === 0 && <div className="no-results">No documents match “{query}”.</div>}</div>}
        <section className="chat-workbench"><div className="chat-title-row"><div><div className="eyebrow">DOCUMENT CHAT</div><h2>{activeDocument ? `Ask about ${activeDocument.name}` : "Start a conversation"}</h2><p>Chat sessions save messages for later reference.</p></div>{activeDocument && !selectedSession && <button className="secondary-button" onClick={() => void startChat()} disabled={busy || activeDocument.status !== "COMPLETED"}>{busy ? "Creating…" : "＋ New chat"}</button>}</div>
          {!activeDocument ? <div className="chat-placeholder">Select a document above to start a chat.</div> : activeDocument.status !== "COMPLETED" ? <div className="chat-placeholder">This document is {activeDocument.status.toLowerCase()}. Chat becomes available after processing completes.</div> : !selectedSession ? <div className="chat-placeholder">Create a chat session to save your questions about this document.</div> : <><div className="messages-area">{messages.length === 0 && <div className="chat-placeholder">Ask a question to save it in this session. AI generated answers are not available yet.</div>}{messages.map((message) => <div className="message-row" key={message.id}><span className="message-avatar">{message.role === "user" ? "Y" : "F"}</span><div className="message-bubble"><strong>{message.role === "user" ? "You" : "Assistant"}</strong><p>{message.content}</p></div></div>)}<div ref={messagesEnd} /></div><form className="composer" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" aria-label="Message"/><button type="submit" disabled={busy || !draft.trim()} aria-label="Send message">↑</button></form><p className="chat-capability-note">Messages are stored by the API. This version does not generate AI answers.</p></>}
        </section>
        <footer className="page-footer"><span>Folio workspace</span><span>PDF · DOCX · TXT · MD · CSV</span></footer>
      </div>
    </section>
  </main>;
}
