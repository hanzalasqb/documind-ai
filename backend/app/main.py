import json
import uuid

from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import Settings, get_settings
from app.schemas import ChatRequest, ChatResponse, DocumentOut
from app.services.chunker import chunk_text
from app.services.llm import LLMProvider, OpenAICompatibleProvider
from app.services.parser import extract_text
from app.services.rag import RAGPipeline
from app.services.vector_store import VectorStore

settings = get_settings()
app = FastAPI(title="DocuMind AI", version="1.0.0", description="RAG-powered document Q&A API")
app.add_middleware(CORSMiddleware, allow_origins=settings.cors_list, allow_methods=["*"], allow_headers=["*"])

_store = VectorStore(settings.data_dir)
_llm: LLMProvider = OpenAICompatibleProvider(settings)


def get_store() -> VectorStore:
    return _store


def get_llm() -> LLMProvider:
    return _llm


def get_rag(llm: LLMProvider = Depends(get_llm), store: VectorStore = Depends(get_store)) -> RAGPipeline:
    return RAGPipeline(llm, store, settings.top_k)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/documents", response_model=DocumentOut, status_code=201)
async def upload_document(
    file: UploadFile,
    cfg: Settings = Depends(get_settings),
    llm: LLMProvider = Depends(get_llm),
    store: VectorStore = Depends(get_store),
):
    data = await file.read()
    if len(data) > cfg.max_upload_mb * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {cfg.max_upload_mb} MB limit")
    try:
        text = extract_text(file.filename or "upload.txt", data)
    except ValueError as e:
        raise HTTPException(415, str(e)) from e
    chunks = chunk_text(text, cfg.chunk_size, cfg.chunk_overlap)
    if not chunks:
        raise HTTPException(422, "No extractable text found in document")
    embeddings = await llm.embed(chunks)
    doc_id = uuid.uuid4().hex[:12]
    store.add(doc_id, file.filename or "upload", chunks, embeddings)
    return DocumentOut(id=doc_id, filename=file.filename or "upload", chunks=len(chunks))


@app.get("/api/documents", response_model=list[DocumentOut])
def list_documents(store: VectorStore = Depends(get_store)):
    return store.documents()


@app.delete("/api/documents/{doc_id}", status_code=204)
def delete_document(doc_id: str, store: VectorStore = Depends(get_store)):
    if not store.delete(doc_id):
        raise HTTPException(404, "Document not found")


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, rag: RAGPipeline = Depends(get_rag)):
    sources = await rag.retrieve(req.question, req.document_ids)
    answer = await rag.llm.chat(rag.build_messages(req.question, sources, req.history))
    return ChatResponse(answer=answer, sources=sources)


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest, rag: RAGPipeline = Depends(get_rag)):
    """Server-Sent Events: first a `sources` event, then `token` events, then `done`."""
    sources = await rag.retrieve(req.question, req.document_ids)
    messages = rag.build_messages(req.question, sources, req.history)

    async def events():
        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"
        try:
            async for token in rag.llm.stream(messages):
                yield f"event: token\ndata: {json.dumps(token)}\n\n"
        except Exception as e:  # surface provider errors to the client
            yield f"event: error\ndata: {json.dumps(str(e))}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream")
