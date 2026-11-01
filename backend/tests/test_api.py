def _upload(client, name, text):
    return client.post("/api/documents", files={"file": (name, text.encode(), "text/plain")})


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_upload_list_chat_delete(client):
    r = _upload(client, "policy.txt", "Employees get 24 paid leave days per year.\n\nRemote work is allowed on Fridays.")
    assert r.status_code == 201
    doc_id = r.json()["id"]
    _upload(client, "menu.txt", "The cafeteria serves biryani on Mondays.")

    assert any(d["id"] == doc_id for d in client.get("/api/documents").json())

    r = client.post("/api/chat", json={"question": "How many paid leave days do employees get?"})
    assert r.status_code == 200
    body = r.json()
    assert body["sources"][0]["filename"] == "policy.txt"
    assert "[1]" in body["answer"]

    assert client.delete(f"/api/documents/{doc_id}").status_code == 204
    assert client.delete(f"/api/documents/{doc_id}").status_code == 404


def test_rejects_unsupported_file(client):
    r = client.post("/api/documents", files={"file": ("image.png", b"\x89PNG", "image/png")})
    assert r.status_code == 415


def test_stream_emits_sources_and_tokens(client):
    _upload(client, "faq.txt", "Support hours are 9am to 6pm PKT.")
    with client.stream("POST", "/api/chat/stream", json={"question": "What are support hours?"}) as r:
        body = "".join(r.iter_text())
    assert "event: sources" in body and "event: token" in body and "event: done" in body
