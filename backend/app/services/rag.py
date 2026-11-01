from app.services.llm import LLMProvider
from app.services.vector_store import VectorStore

SYSTEM_PROMPT = """You are DocuMind, an assistant that answers strictly from the provided context.
- Cite sources inline as [1], [2] matching the numbered context blocks.
- If the answer is not in the context, say you could not find it in the documents.
- Be concise and use markdown where it helps readability."""


class RAGPipeline:
    def __init__(self, llm: LLMProvider, store: VectorStore, top_k: int = 4):
        self.llm, self.store, self.top_k = llm, store, top_k

    async def retrieve(self, question: str, document_ids: list[str] | None = None) -> list[dict]:
        [q_emb] = await self.llm.embed([question])
        return self.store.search(q_emb, k=self.top_k, document_ids=document_ids)

    @staticmethod
    def build_messages(question: str, sources: list[dict], history: list[dict]) -> list[dict]:
        context = "\n\n".join(f"[{i + 1}] ({s['filename']})\n{s['text']}" for i, s in enumerate(sources))
        safe_history = [
            {"role": h["role"], "content": str(h.get("content", ""))[:4000]}
            for h in history[-6:]
            if h.get("role") in {"user", "assistant"}
        ]
        return [
            {"role": "system", "content": SYSTEM_PROMPT},
            *safe_history,
            {"role": "user", "content": f"Context:\n{context or 'No documents found.'}\n\nQuestion: {question}"},
        ]
