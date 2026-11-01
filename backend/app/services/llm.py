"""Thin client for any OpenAI-compatible API (OpenAI, Groq, Together, Ollama...)."""
import json
from collections.abc import AsyncIterator
from typing import Protocol

import httpx

from app.config import Settings


class LLMProvider(Protocol):
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
    async def chat(self, messages: list[dict]) -> str: ...
    def stream(self, messages: list[dict]) -> AsyncIterator[str]: ...


class OpenAICompatibleProvider:
    def __init__(self, settings: Settings):
        self.s = settings
        self.headers = {"Authorization": f"Bearer {settings.llm_api_key}"}

    async def embed(self, texts: list[str]) -> list[list[float]]:
        out: list[list[float]] = []
        async with httpx.AsyncClient(base_url=self.s.llm_base_url, headers=self.headers, timeout=60) as c:
            for i in range(0, len(texts), 64):  # batch to respect provider limits
                r = await c.post("/embeddings", json={"model": self.s.embedding_model, "input": texts[i : i + 64]})
                r.raise_for_status()
                out.extend(d["embedding"] for d in r.json()["data"])
        return out

    async def chat(self, messages: list[dict]) -> str:
        async with httpx.AsyncClient(base_url=self.s.llm_base_url, headers=self.headers, timeout=120) as c:
            r = await c.post("/chat/completions", json={"model": self.s.chat_model, "messages": messages, "temperature": 0.2})
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def stream(self, messages: list[dict]) -> AsyncIterator[str]:
        payload = {"model": self.s.chat_model, "messages": messages, "temperature": 0.2, "stream": True}
        async with httpx.AsyncClient(base_url=self.s.llm_base_url, headers=self.headers, timeout=120) as c:
            async with c.stream("POST", "/chat/completions", json=payload) as r:
                r.raise_for_status()
                async for line in r.aiter_lines():
                    if not line.startswith("data: ") or line.endswith("[DONE]"):
                        continue
                    delta = json.loads(line[6:])["choices"][0].get("delta", {}).get("content")
                    if delta:
                        yield delta
