import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { deleteDoc, Doc, listDocs, Msg, streamChat, uploadDoc } from "./api";

export default function App() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => { listDocs().then(setDocs).catch(() => setError("Backend not reachable")); }, []);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  async function onUpload(files: FileList | null) {
    if (!files) return;
    setError(null);
    for (const f of Array.from(files)) {
      try { const d = await uploadDoc(f); setDocs((p) => [...p, d]); }
      catch (e) { setError((e as Error).message); }
    }
  }

  async function ask() {
    const q = input.trim();
    if (!q || busy) return;
    const history = messages;
    setMessages([...history, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setInput(""); setBusy(true); setError(null);
    const patch = (fn: (m: Msg) => Msg) =>
      setMessages((p) => [...p.slice(0, -1), fn(p[p.length - 1])]);
    try {
      await streamChat(q, history, selected.length ? selected : null,
        (sources) => patch((m) => ({ ...m, sources })),
        (t) => patch((m) => ({ ...m, content: m.content + t })));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="layout">
      <aside>
        <h1>📚 DocuMind <span>AI</span></h1>
        <label className="upload">
          + Upload PDF / TXT / MD
          <input type="file" multiple accept=".pdf,.txt,.md" onChange={(e) => onUpload(e.target.files)} hidden />
        </label>
        <p className="hint">{selected.length ? `Searching ${selected.length} selected` : "Searching all documents"}</p>
        <ul>
          {docs.map((d) => (
            <li key={d.id} className={selected.includes(d.id) ? "active" : ""}>
              <button className="doc" onClick={() =>
                setSelected((s) => (s.includes(d.id) ? s.filter((x) => x !== d.id) : [...s, d.id]))}>
                {d.filename}<small>{d.chunks} chunks</small>
              </button>
              <button className="del" title="Delete" onClick={async () => {
                await deleteDoc(d.id); setDocs((p) => p.filter((x) => x.id !== d.id));
                setSelected((s) => s.filter((x) => x !== d.id));
              }}>×</button>
            </li>
          ))}
        </ul>
      </aside>
      <main>
        <div className="messages">
          {messages.length === 0 && (
            <div className="empty"><h2>Ask anything about your documents</h2>
              <p>Answers are grounded in your files with numbered citations.</p></div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <ReactMarkdown>{m.content || (busy && i === messages.length - 1 ? "…" : "")}</ReactMarkdown>
              {m.sources && m.sources.length > 0 && (
                <details><summary>{m.sources.length} sources</summary>
                  {m.sources.map((s, j) => (
                    <blockquote key={j}><b>[{j + 1}] {s.filename}</b> · score {s.score.toFixed(2)}
                      <p>{s.text.slice(0, 280)}…</p></blockquote>
                  ))}
                </details>
              )}
            </div>
          ))}
          <div ref={bottom} />
        </div>
        {error && <div className="error">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); ask(); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" />
          <button disabled={busy || !input.trim()}>{busy ? "Thinking…" : "Send"}</button>
        </form>
      </main>
    </div>
  );
}
