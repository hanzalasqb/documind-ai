export type Doc = { id: string; filename: string; chunks: number };
export type Source = { document_id: string; filename: string; chunk_index: number; score: number; text: string };
export type Msg = { role: "user" | "assistant"; content: string; sources?: Source[] };

const BASE = import.meta.env.VITE_API_URL ?? "";

export async function listDocs(): Promise<Doc[]> {
  const r = await fetch(`${BASE}/api/documents`);
  return r.json();
}

export async function uploadDoc(file: File): Promise<Doc> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${BASE}/api/documents`, { method: "POST", body: fd });
  if (!r.ok) throw new Error((await r.json()).detail ?? "Upload failed");
  return r.json();
}

export async function deleteDoc(id: string) {
  await fetch(`${BASE}/api/documents/${id}`, { method: "DELETE" });
}

/** Streams an answer over SSE. Calls onSources once, onToken per token. */
export async function streamChat(
  question: string,
  history: Msg[],
  documentIds: string[] | null,
  onSources: (s: Source[]) => void,
  onToken: (t: string) => void
) {
  const r = await fetch(`${BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      document_ids: documentIds,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  });
  if (!r.ok || !r.body) throw new Error("Chat request failed");
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const evt of events) {
      const type = evt.match(/^event: (.*)$/m)?.[1];
      const data = evt.match(/^data: (.*)$/m)?.[1];
      if (!type || data === undefined) continue;
      if (type === "sources") onSources(JSON.parse(data));
      else if (type === "token") onToken(JSON.parse(data));
      else if (type === "error") throw new Error(JSON.parse(data));
    }
  }
}
