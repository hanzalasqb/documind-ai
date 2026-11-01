import pytest

from app.services.chunker import chunk_text


def test_empty_text_returns_no_chunks():
    assert chunk_text("   ") == []


def test_chunks_respect_size_and_overlap():
    text = ". ".join(f"Sentence number {i} about retrieval" for i in range(200))
    chunks = chunk_text(text, size=300, overlap=50)
    assert len(chunks) > 5
    assert all(len(c) <= 300 for c in chunks)


def test_invalid_overlap():
    with pytest.raises(ValueError):
        chunk_text("abc", size=100, overlap=100)
