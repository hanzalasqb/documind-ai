import hashlib
import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp()

import pytest
from fastapi.testclient import TestClient

from app.main import app, get_llm


class FakeLLM:
    """Deterministic bag-of-words embeddings so retrieval can be tested offline."""

    DIM = 256

    def _vec(self, text: str) -> list[float]:
        v = [0.0] * self.DIM
        for w in text.lower().split():
            v[int(hashlib.md5(w.strip(".,?!").encode()).hexdigest(), 16) % self.DIM] += 1
        return v

    async def embed(self, texts):
        return [self._vec(t) for t in texts]

    async def chat(self, messages):
        return "Answer based on context [1]"

    async def stream(self, messages):
        for t in ["Answer ", "[1]"]:
            yield t


@pytest.fixture
def client():
    app.dependency_overrides[get_llm] = lambda: FakeLLM()
    yield TestClient(app)
    app.dependency_overrides.clear()
