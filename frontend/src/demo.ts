/**
 * Browser-only RAG pipeline for the live demo (VITE_DEMO=true).
 * Same chunking rules as backend/app/services/chunker.py, BM25 retrieval in place of
 * embeddings, and an extractive answer with [n] citations in place of the LLM.
 */
import type { Doc, Msg, Source } from "./api";
import { SAMPLE_DOCS } from "./demoDocs";

/** TypeScript port of backend chunk_text(). */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  text = text.replace(/[ \t]+/g, " ").trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      for (const sep of ["\n\n", ". ", "\n"]) {
        const idx = window.lastIndexOf(sep);
        if (idx > Math.floor(size / 2)) { end = start + idx + sep.length; break; }
      }
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

const STOP = new Set(("a an the and or but if of to in on at for with by from as is are was were be been it this that these those " +
  "what which who whom how when where why do does did can could should would will i you we they he she my our your their " +
  "me us them about into than then so not no yes any all there here have has had").split(" "));

export const tokenize = (t: string) =>
  (t.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOP.has(w)).map((w) => (w.length > 4 ? w.replace(/(able|ing|ed|es|s)$/, "") : w));

type Chunk = { docId: string; filename: string; index: number; text: string; terms: string[] };

const docs = new Map<string, { doc: Doc; chunks: Chunk[] }>();
let nextId = 1;

function addDocument(filename: string, text: string): Doc {
  const id = `demo-${nextId++}`;
  const chunks = chunkText(text).map((c, index) => ({ docId: id, filename, index, text: c, terms: tokenize(c) }));
  const doc = { id, filename, chunks: chunks.length };
  docs.set(id, { doc, chunks });
  return doc;
}
SAMPLE_DOCS.forEach((d) => addDocument(d.filename, d.text));

/** Okapi BM25 over all chunks (k1 = 1.5, b = 0.75). */
export function search(question: string, documentIds: string[] | null, k = 4): Source[] {
  const pool = [...docs.values()].filter((d) => !documentIds || documentIds.includes(d.doc.id)).flatMap((d) => d.chunks);
  if (!pool.length) return [];
  const q = [...new Set(tokenize(question))];
  const avg = pool.reduce((n, c) => n + c.terms.length, 0) / pool.length;
  const df = new Map(q.map((t) => [t, pool.filter((c) => c.terms.includes(t)).length]));
  const scored = pool.map((c) => {
    let s = 0;
    for (const t of q) {
      const tf = c.terms.filter((x) => x === t).length;
      if (!tf) continue;
      const idf = Math.log(1 + (pool.length - df.get(t)! + 0.5) / (df.get(t)! + 0.5));
      s += idf * ((tf * 2.5) / (tf + 1.5 * (0.25 + 0.75 * (c.terms.length / avg))));
    }
    return { c, s };
  });
  const best = Math.max(...scored.map((x) => x.s), 0);
  return scored
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map(({ c, s }) => ({ document_id: c.docId, filename: c.filename, chunk_index: c.index, score: best ? s / best : 0, text: c.text }));
}

/** Picks the sentences from the retrieved chunks that best match the question and cites them. */
export function composeAnswer(question: string, sources: Source[]): string {
  if (!sources.length) return "I could not find this in the documents. Try different words, or upload a document that covers it.";
  const q = new Set(tokenize(question));
  const picked: { sentence: string; cite: number; score: number }[] = [];
  sources.forEach((s, i) => {
    const lines = s.text.split(/\n+/).filter((l) => !/^\s*#/.test(l)); // skip markdown headings
    for (const raw of lines.flatMap((l) => l.split(/(?<=[.!?])\s+/))) {
      const sentence = raw.replace(/^[-*\s]+/, "").trim();
      if (sentence.length < 25 || sentence.endsWith("?")) continue;
      const terms = tokenize(sentence);
      const hits = terms.filter((t) => q.has(t)).length;
      if (hits) picked.push({ sentence, cite: i + 1, score: (hits * hits) / Math.sqrt(terms.length) + s.score * 0.5 });
    }
  });
  picked.sort((a, b) => b.score - a.score);
  const cutoff = (picked[0]?.score ?? 0) * 0.55; // drop weakly related sentences
  const top = picked.filter((p, i, a) => p.score >= cutoff && a.findIndex((x) => x.sentence === p.sentence) === i).slice(0, 3);
  if (!top.length) return "I could not find a direct answer in the documents.";
  const lines = top.map((p) => `- ${p.sentence.replace(/[.!?]?$/, ".")} [${p.cite}]`);
  return `Here is what the documents say:\n\n${lines.join("\n")}\n\n_Demo mode: extractive answer from BM25 retrieval. The full app writes the answer with an LLM._`;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demoApi = {
  async listDocs(): Promise<Doc[]> {
    return [...docs.values()].map((d) => d.doc);
  },
  async uploadDoc(file: File): Promise<Doc> {
    if (!/\.(txt|md)$/i.test(file.name)) throw new Error("The live demo reads .txt and .md files. Run the full app for PDFs.");
    if (file.size > 1_000_000) throw new Error("Demo upload limit is 1 MB");
    const text = await file.text();
    if (!text.trim()) throw new Error("The file is empty");
    return addDocument(file.name, text);
  },
  async deleteDoc(id: string) {
    docs.delete(id);
  },
  async streamChat(question: string, _history: Msg[], documentIds: string[] | null, onSources: (s: Source[]) => void, onToken: (t: string) => void) {
    await wait(250);
    const sources = search(question, documentIds);
    onSources(sources);
    for (const token of composeAnswer(question, sources).match(/\S+\s*/g) ?? []) {
      onToken(token);
      await wait(18);
    }
  },
};
