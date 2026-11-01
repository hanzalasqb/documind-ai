from pydantic import BaseModel, Field


class DocumentOut(BaseModel):
    id: str
    filename: str
    chunks: int


class ChatRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    document_ids: list[str] | None = None
    history: list[dict] = Field(default_factory=list, max_length=20)


class Source(BaseModel):
    document_id: str
    filename: str
    chunk_index: int
    score: float
    text: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
