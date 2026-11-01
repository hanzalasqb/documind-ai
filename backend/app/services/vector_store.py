"""Lightweight persistent vector store (NumPy cosine similarity).

Good for single-node deployments and thousands of chunks. The interface mirrors
what you'd swap for pgvector / Qdrant / Pinecone in a larger deployment.
"""
import json
import threading
from pathlib import Path

import numpy as np


class VectorStore:
    def __init__(self, data_dir: str):
        self.dir = Path(data_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self._meta_path = self.dir / "chunks.json"
        self._vec_path = self.dir / "vectors.npy"
        self._lock = threading.Lock()
        self.meta: list[dict] = json.loads(self._meta_path.read_text()) if self._meta_path.exists() else []
        self.vectors: np.ndarray | None = np.load(self._vec_path) if self._vec_path.exists() else None

    def _persist(self) -> None:
        self._meta_path.write_text(json.dumps(self.meta))
        if self.vectors is not None:
            np.save(self._vec_path, self.vectors)

    @staticmethod
    def _normalize(v: np.ndarray) -> np.ndarray:
        norms = np.linalg.norm(v, axis=1, keepdims=True)
        return v / np.clip(norms, 1e-10, None)

    def add(self, doc_id: str, filename: str, chunks: list[str], embeddings: list[list[float]]) -> None:
        vecs = self._normalize(np.asarray(embeddings, dtype=np.float32))
        with self._lock:
            self.vectors = vecs if self.vectors is None else np.vstack([self.vectors, vecs])
            self.meta += [
                {"document_id": doc_id, "filename": filename, "chunk_index": i, "text": t}
                for i, t in enumerate(chunks)
            ]
            self._persist()

    def search(self, query_embedding: list[float], k: int = 4, document_ids: list[str] | None = None) -> list[dict]:
        if self.vectors is None or not self.meta:
            return []
        q = self._normalize(np.asarray([query_embedding], dtype=np.float32))[0]
        scores = self.vectors @ q
        if document_ids:
            mask = np.array([m["document_id"] in document_ids for m in self.meta])
            scores = np.where(mask, scores, -np.inf)
        top = np.argsort(-scores)[:k]
        return [{**self.meta[i], "score": float(scores[i])} for i in top if np.isfinite(scores[i])]

    def documents(self) -> list[dict]:
        docs: dict[str, dict] = {}
        for m in self.meta:
            d = docs.setdefault(m["document_id"], {"id": m["document_id"], "filename": m["filename"], "chunks": 0})
            d["chunks"] += 1
        return list(docs.values())

    def delete(self, doc_id: str) -> bool:
        with self._lock:
            keep = [i for i, m in enumerate(self.meta) if m["document_id"] != doc_id]
            if len(keep) == len(self.meta):
                return False
            self.meta = [self.meta[i] for i in keep]
            self.vectors = self.vectors[keep] if keep else None
            if self.vectors is None and self._vec_path.exists():
                self._vec_path.unlink()
            self._persist()
            return True
