"use client";
/* eslint react-hooks/set-state-in-effect: off */

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/auth-provider";
import { ChatMessage, ChatSession, createSession, deleteDocument, deleteSession, DocumentRecord, documentEvents, getDocument, getSession, listDocuments, listMessages, listSessions, renameDocument, streamMessage, uploadDocument } from "@/lib/document-api";

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
  const [messageStates, setMessageStates] = useState<Record<number, "streaming" | "interrupted" | "failed">>({});
  const [messageErrors, setMessageErrors] = useState<Record<number, string>>({});
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatRetry, setChatRetry] = useState(0);
  const [selectedDocument, setSelectedDocument] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const streams = useRef(new Map<number, AbortController>());
  const submitLock = useRef(false);
  const chatAbort = useRef<AbortController | null>(null);
  const temporaryMessageId = useRef(-1);

  // URL state is restored on mount so document and session links survive refreshes.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const documentId = Number(params.get("document"));
    const sessionId = Number(params.get("session"));
    if (Number.isInteger(documentId) && documentId > 0) setSelectedDocument(documentId);
    if (Number.isInteger(sessionId) && sessionId > 0) setSelectedSession(sessionId);
  }, []);

  const persistSelection = useCallback((documentId: number | null, sessionId: number | null) => {
    const params = new URLSearchParams();
    if (documentId) params.set("document", String(documentId));
    if (sessionId) params.set("session", String(sessionId));
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) return;
    try { const docs = await listDocuments(token); setDocuments(docs); setError(""); }
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
  useEffect(() => () => { for (const controller of streams.current.values()) controller.abort(); streams.current.clear(); chatAbort.current?.abort(); }, []);
  useEffect(() => {
    if (!token || !selectedDocument) { setSessions([]); setSessionsLoading(false); return; }
    let alive = true; setSessionsLoading(true); setChatError("");
    listSessions(token, selectedDocument).then((items) => {
      if (!alive) return;
      setSessions(items);
      if (selectedSession && !items.some((item) => item.id === selectedSession)) { setSelectedSession(null); setMessages([]); persistSelection(selectedDocument, null); }
      else if (!selectedSession && chatExpanded && items.length) { setSelectedSession(items[0].id); persistSelection(selectedDocument, items[0].id); }
    }).catch((e) => { if (alive) setChatError(e instanceof Error ? e.message : "Could not load chat sessions."); })
      .finally(() => { if (alive) setSessionsLoading(false); });
    return () => { alive = false; };
  }, [token, selectedDocument, selectedSession, chatExpanded, persistSelection, chatRetry]);
  // Clear prior session content before loading the newly selected conversation.
  useEffect(() => {
    setMessages([]); setMessageStates({}); setMessageErrors({}); setDraft("");
    if (!token || !selectedSession) { setMessagesLoading(false); return; }
    let alive = true; setMessagesLoading(true); setChatError("");
    listMessages(token, selectedSession).then((items) => { if (alive) setMessages(items); })
      .catch((e) => { if (alive) setChatError(e instanceof Error ? e.message : "Could not load messages."); })
      .finally(() => { if (alive) setMessagesLoading(false); });
    return () => { alive = false; };
  }, [token, selectedSession, chatRetry]);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const filteredDocuments = useMemo(() => documents.filter((doc) => `${doc.name} ${doc.file_name}`.toLowerCase().includes(query.toLowerCase())), [documents, query]);
  const activeDocument = documents.find((doc) => doc.id === selectedDocument) ?? null;

  function stopActiveStream() {
    if (!chatAbort.current) return;
    chatAbort.current.abort(); chatAbort.current = null; submitLock.current = false; setBusy(false);
  }

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
    stopActiveStream();
    setSelectedDocument(id); setSelectedSession(null); setMessages([]); setMessageStates({}); setMessageErrors({}); setChatError(""); persistSelection(id, null);
    if (!token) return;
    try { const latest = await getDocument(token, id); setDocuments((items) => items.map((item) => item.id === id ? latest : item)); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load document."); }
  }
  function openDocumentChat(doc: DocumentRecord) {
    void openDocument(doc.id);
    setChatExpanded(true);
  }
  async function openChat(session: ChatSession) {
    stopActiveStream();
    setSelectedDocument(session.document_id); setSelectedSession(session.id); setMessages([]); setMessageStates({}); setMessageErrors({}); setChatError(""); persistSelection(session.document_id, session.id);
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
    stopActiveStream();
    setBusy(true); setError("");
    try { const session = await createSession(token, activeDocument.id, `Questions about ${activeDocument.name}`); setSessions((items) => [session, ...items]); setSelectedSession(session.id); setMessages([]); setMessageStates({}); setMessageErrors({}); setChatError(""); persistSelection(activeDocument.id, session.id); setNotice("Chat session created."); }
    catch (e) { setChatError(e instanceof Error ? e.message : "Could not create chat session."); }
    finally { setBusy(false); }
  }
  async function submitQuestion(content: string, retryAssistantId?: number) {
    const question = content.trim(); if (!question || !token || !selectedSession || submitLock.current) return;
    submitLock.current = true;
    const sessionId = selectedSession;
    const userId = temporaryMessageId.current;
    temporaryMessageId.current -= 2;
    const assistantId = userId - 1;
    const now = new Date().toISOString();
    const userMessage: ChatMessage = { id: userId, session_id: sessionId, role: "user", content: question, created_at: now };
    const assistantMessage: ChatMessage = { id: assistantId, session_id: sessionId, role: "assistant", content: "", created_at: now };
    if (retryAssistantId !== undefined) {
      setMessages((items) => items.filter((item) => item.id !== retryAssistantId && item.id !== retryAssistantId + 1));
      setMessageStates((items) => { const next = { ...items }; delete next[retryAssistantId]; return next; });
      setMessageErrors((items) => { const next = { ...items }; delete next[retryAssistantId]; return next; });
    }
    setMessages((items) => [...items, userMessage, assistantMessage]);
    setMessageStates((items) => ({ ...items, [assistantId]: "streaming" }));
    setBusy(true); setError(""); setChatError("");
    const controller = new AbortController(); chatAbort.current = controller;
    try {
      const turn = await streamMessage(token, sessionId, question, controller.signal, (chunk) => {
        if (chatAbort.current === controller) setMessages((items) => items.map((message) => message.id === assistantId ? { ...message, content: message.content + chunk } : message));
      });
      if (chatAbort.current !== controller) return;
      setMessages((items) => items.map((message) => message.id === userId ? turn.user_message : message.id === assistantId ? turn.assistant_message : message));
      setMessageStates((items) => { const next = { ...items }; delete next[assistantId]; return next; });
      setMessageErrors((items) => { const next = { ...items }; delete next[assistantId]; return next; });
      setDraft("");
    } catch (e) {
      if (chatAbort.current !== controller) return;
      const interrupted = controller.signal.aborted;
      const errorMessage = interrupted ? "Response interrupted. Retry the question to get a complete answer." : e instanceof Error ? e.message : "Could not get an answer.";
      setMessageStates((items) => ({ ...items, [assistantId]: interrupted ? "interrupted" : "failed" }));
      setMessageErrors((items) => ({ ...items, [assistantId]: errorMessage }));
      setChatError("");
    } finally {
      if (chatAbort.current === controller) { chatAbort.current = null; submitLock.current = false; setBusy(false); }
    }
  }
  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    const failedAssistant = [...messages].reverse().find((message) => message.role === "assistant" && messageStates[message.id] && messageStates[message.id] !== "streaming");
    const priorQuestion = failedAssistant && messages.find((message) => message.id === failedAssistant.id + 1)?.content;
    await submitQuestion(question, priorQuestion === question ? failedAssistant?.id : undefined);
  }
  function cancelStream() {
    chatAbort.current?.abort();
  }
  function retryChat() {
    const failedAssistant = [...messages].reverse().find((message) => message.role === "assistant" && messageStates[message.id] && messageStates[message.id] !== "streaming");
    const question = failedAssistant && messages.find((message) => message.id === failedAssistant.id + 1)?.content;
    if (failedAssistant && question) void submitQuestion(question, failedAssistant.id);
    else setChatRetry((value) => value + 1);
  }
  async function removeChat(session: ChatSession) {
    if (!token || !window.confirm("Delete this chat session and its messages?")) return;
    try { await deleteSession(token, session.id); setSessions((items) => items.filter((item) => item.id !== session.id)); if (selectedSession === session.id) { setSelectedSession(null); setMessages([]); persistSelection(selectedDocument, null); } }
    catch (e) { setError(e instanceof Error ? e.message : "Could not delete session."); }
  }

  return <main className="workspace-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">F</span><span>Folio<span className="brand-dot">.</span></span></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="nav-list"><button className="nav-item active"><span>▤</span> Documents <span className="nav-count">{documents.length}</span></button><a className="nav-item" href="/projects"><span>◈</span> Previous projects</a></nav>
      <div className="sidebar-section"><div className="sidebar-heading">DOCUMENT CHATS <span>{sessions.length}</span></div>
        <div className="chat-list">{sessions.slice(0, 8).map((session) => <div key={session.id} className={`chat-entry ${selectedSession === session.id ? "selected" : ""}`}><button onClick={() => void openChat(session)} title={session.title || "Document chat"}>{session.title || "Document chat"}</button><button className="chat-delete" aria-label="Delete chat" onClick={() => void removeChat(session)}>×</button></div>)}{sessionsLoading && <p className="empty-sidebar">Loading chats…</p>}{!sessionsLoading && selectedDocument && !sessions.length && <p className="empty-sidebar">No chats for this document</p>}{!selectedDocument && <p className="empty-sidebar">Select a document</p>}</div>
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
        {documents.length === 0 ? <div className="empty-state"><div className="empty-art"><span>▤</span><i>＋</i></div><h3>Your library starts here</h3><p>Upload a PDF, DOCX, TXT, Markdown, or CSV file to get started.</p><button className="primary-button" onClick={() => fileRef.current?.click()}>＋ Upload your first document</button></div> : <div className="document-table-wrap"><table className="document-table"><thead><tr><th>NAME</th><th>STATUS</th><th>SIZE</th><th>ADDED</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{filteredDocuments.map((doc) => <tr key={doc.id} className={selectedDocument === doc.id ? "row-selected" : ""} onClick={() => void openDocument(doc.id)}><td><div className="doc-name"><span className="file-tile">{doc.file_name.toLowerCase().endsWith(".pdf") ? "PDF" : doc.file_name.split(".").pop()?.slice(0, 3).toUpperCase() || "FILE"}</span><div><strong>{doc.name}</strong><span>{doc.file_name}</span></div></div></td><td><span className={`status-pill status-${doc.status.toLowerCase()}`}><i />{doc.status === "PROCESSING" ? `${doc.stage || "Processing"} · ${doc.progress}%` : doc.status}</span>{doc.error_message && <span className="processing-error">{doc.error_message}</span>}</td><td className="muted-cell">{formatBytes(doc.file_size)}</td><td className="muted-cell">{dateLabel(doc.created_at)}</td><td><div className="row-actions"><button onClick={(e) => { e.stopPropagation(); openDocumentChat(doc); }} aria-label={`Open chat for ${doc.name}`} title="Open chat in side panel">◫</button><button onClick={(e) => { e.stopPropagation(); void rename(doc); }} aria-label="Rename document" title="Rename">✎</button><button onClick={(e) => { e.stopPropagation(); void removeDocument(doc); }} aria-label="Delete document" title="Delete">⌫</button></div></td></tr>)}</tbody></table>{filteredDocuments.length === 0 && <div className="no-results">No documents match “{query}”.</div>}</div>}
        {chatExpanded && <button className="chat-overlay" aria-label="Close chat panel" onClick={() => setChatExpanded(false)} />}
        <section className={`chat-workbench${chatExpanded ? " chat-drawer" : ""}`} role={chatExpanded ? "dialog" : undefined} aria-modal={chatExpanded || undefined} aria-label="Document chat"><div className="chat-title-row"><div><div className="eyebrow">DOCUMENT CHAT</div><h2>{activeDocument ? `Ask about ${activeDocument.name}` : "Start a conversation"}</h2><p>Chat sessions save messages for later reference.</p></div><div className="chat-title-actions">{activeDocument && !selectedSession && <button className="secondary-button" onClick={() => void startChat()} disabled={busy || sessionsLoading || activeDocument.status !== "COMPLETED"}>{busy ? "Creating…" : "＋ New chat"}</button>}<button className="secondary-button" onClick={() => setChatExpanded((value) => !value)} aria-label={chatExpanded ? "Close expanded chat" : "Expand chat"}>{chatExpanded ? "× Close" : "↗ Expand"}</button></div></div>
          {chatError && <div role="alert" className="chat-inline-error"><span>{chatError}</span><button className="secondary-button" onClick={retryChat}>Retry</button></div>}
          {!activeDocument ? <div className="chat-placeholder">Select a document above to start a chat.</div> : activeDocument.status !== "COMPLETED" ? <div className="chat-placeholder">This document is {activeDocument.status.toLowerCase()}. Chat becomes available after processing completes.</div> : !selectedSession || sessionsLoading || !sessions.some((session) => session.id === selectedSession) ? <div className="chat-placeholder">{selectedSession && !chatError ? "Loading document chats…" : "Create a chat session to ask questions about this document."}</div> : <><div className="messages-area">{messagesLoading ? <div className="chat-placeholder">Loading conversation…</div> : messages.length === 0 && !chatError ? <div className="chat-placeholder">Ask a question to get an answer grounded in this document.</div> : messages.map((message) => <div className={`message-row${message.role === "user" ? " message-row-user" : ""}`} key={message.id}><span className="message-avatar">{message.role === "user" ? "Y" : "F"}</span><div className="message-bubble"><strong>{message.role === "user" ? "You" : "Assistant"}</strong><p>{message.content || (messageStates[message.id] === "streaming" ? "Thinking…" : "")}</p>{messageStates[message.id] === "streaming" && <span className="message-status">Generating</span>}{messageErrors[message.id] && <p className="message-error" role="alert">{messageErrors[message.id]}</p>}{messageStates[message.id] && messageStates[message.id] !== "streaming" && <button className="retry-question" onClick={() => void submitQuestion(messages.find((item) => item.id === message.id + 1)?.content || draft, message.id)}>Retry question</button>}</div></div>)}<div ref={messagesEnd} /></div><form className="composer" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask a question about this document…" aria-label="Message" disabled={busy || messagesLoading}/>{busy ? <button type="button" onClick={cancelStream} aria-label="Stop generating">■</button> : <button type="submit" disabled={messagesLoading || !draft.trim()} aria-label="Send question">↑</button>}</form><p className="chat-capability-note">{busy ? "The answer is streaming. You can stop it at any time." : "Answers appear as they are generated."}</p></>}
        </section>
        <footer className="page-footer"><span>Folio workspace</span><span>PDF · DOCX · TXT · MD · CSV</span></footer>
      </div>
    </section>
  </main>;
}
