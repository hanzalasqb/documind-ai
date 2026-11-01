import io

from pypdf import PdfReader

SUPPORTED = {".pdf", ".txt", ".md"}


def extract_text(filename: str, data: bytes) -> str:
    """Extract plain text from a PDF, TXT or Markdown upload."""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in SUPPORTED:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(SUPPORTED))}")
    if ext == ".pdf":
        reader = PdfReader(io.BytesIO(data))
        return "\n\n".join(page.extract_text() or "" for page in reader.pages)
    return data.decode("utf-8", errors="ignore")
