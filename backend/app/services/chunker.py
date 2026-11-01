import re


def chunk_text(text: str, size: int = 900, overlap: int = 150) -> list[str]:
    """Split text into overlapping chunks, preferring paragraph/sentence boundaries."""
    if overlap >= size:
        raise ValueError("overlap must be smaller than size")
    text = re.sub(r"[ \t]+", " ", text).strip()
    if not text:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        if end < len(text):
            window = text[start:end]
            # break on the last paragraph, then sentence boundary in the second half of the window
            for sep in ("\n\n", ". ", "\n"):
                idx = window.rfind(sep)
                if idx > size // 2:
                    end = start + idx + len(sep)
                    break
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return chunks
