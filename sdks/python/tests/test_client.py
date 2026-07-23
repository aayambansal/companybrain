"""Client tests driven by httpx MockTransport. No live API required."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from companybrain import AsyncCompanyBrain, CompanyBrain, CompanyBrainError


def make_client(handler, **kwargs):
    transport = httpx.MockTransport(handler)
    return CompanyBrain(
        api_url="http://test.local",
        api_key="cb_test_123",
        transport=transport,
        **kwargs,
    )


def test_sends_bearer_token_and_parses_memory():
    seen = {}

    def handler(request):
        seen["auth"] = request.headers.get("authorization")
        seen["method"] = request.method
        seen["path"] = request.url.path
        return httpx.Response(200, json={"memory": {"id": "m1", "status": "indexed"}})

    cb = make_client(handler)
    memory = cb.memories.add("hello")

    assert seen["auth"] == "Bearer cb_test_123"
    assert seen["method"] == "POST"
    assert seen["path"] == "/v1/memories"
    assert memory["id"] == "m1"


def test_search_builds_json_body():
    captured = {}

    def handler(request):
        captured["path"] = request.url.path
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200, json={"query": "ship", "mode": "hybrid", "hits": [], "tookMs": 3}
        )

    cb = make_client(handler)
    result = cb.search("ship", mode="hybrid", limit=5, min_score=0.2, space_id="s1")

    assert captured["path"] == "/v1/search"
    assert captured["body"] == {
        "q": "ship",
        "mode": "hybrid",
        "limit": 5,
        "minScore": 0.2,
        "spaceId": "s1",
    }
    assert result["mode"] == "hybrid"


def test_memory_add_maps_snake_case_to_camel_case():
    captured = {}

    def handler(request):
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"memory": {"id": "m2"}})

    cb = make_client(handler)
    cb.memories.add(
        "hello",
        title="Note",
        space_id="s1",
        source_url="https://example.com",
        source_type="web",
        tags=["a"],
    )

    assert captured["body"] == {
        "content": "hello",
        "title": "Note",
        "spaceId": "s1",
        "sourceUrl": "https://example.com",
        "sourceType": "web",
        "tags": ["a"],
    }


def test_list_query_params():
    captured = {}

    def handler(request):
        captured["query"] = dict(request.url.params)
        return httpx.Response(200, json={"memories": [], "total": 0, "limit": 10, "offset": 0})

    cb = make_client(handler)
    cb.memories.list(limit=10, offset=5, space_id="s1")

    assert captured["query"] == {"limit": "10", "offset": "5", "spaceId": "s1"}


def test_non_2xx_raises_typed_error():
    def handler(request):
        return httpx.Response(
            401, json={"error": "unauthorized", "message": "Missing credentials."}
        )

    cb = make_client(handler)
    with pytest.raises(CompanyBrainError) as excinfo:
        cb.memories.list()

    err = excinfo.value
    assert err.status == 401
    assert err.code == "unauthorized"
    assert err.message == "Missing credentials."


def test_error_falls_back_to_error_code_when_no_message():
    def handler(request):
        return httpx.Response(422, json={"error": "bad_request", "issues": [{"path": "q"}]})

    cb = make_client(handler)
    with pytest.raises(CompanyBrainError) as excinfo:
        cb.search("")

    err = excinfo.value
    assert err.status == 422
    assert err.code == "bad_request"
    assert err.message == "bad_request"
    assert err.details == [{"path": "q"}]


def test_base_url_trailing_slash_is_normalized():
    cb = CompanyBrain(api_url="http://localhost:3333/", transport=httpx.MockTransport(lambda r: httpx.Response(200, json={})))
    assert cb.api_url == "http://localhost:3333"
    cb.close()


def test_chat_stream_yields_event_data_frames():
    # The server JSON-encodes token payloads; the client decodes them back to
    # text, preserving the whitespace that would otherwise be trimmed off.
    body = (
        "event: citations\ndata: []\n\n"
        'event: token\ndata: "Ship "\n\n'
        'event: token\ndata: "Thursday"\n\n'
        "event: done\ndata: 1\n\n"
    )

    def handler(request):
        assert request.url.path == "/v1/chat/stream"
        return httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})

    cb = make_client(handler)
    frames = list(cb.chat_stream("when do we ship"))
    cb.close()

    assert frames[0] == ("citations", "[]")
    assert ("token", "Ship ") in frames  # trailing space survives
    assert ("token", "Thursday") in frames
    assert frames[-1] == ("done", "1")


def test_async_client_add_and_stream():
    def handler(request):
        if request.url.path == "/v1/chat/stream":
            body = 'event: token\ndata: "hi"\n\nevent: done\ndata: 1\n\n'
            return httpx.Response(200, text=body, headers={"content-type": "text/event-stream"})
        return httpx.Response(200, json={"memory": {"id": "m9"}})

    async def run():
        transport = httpx.MockTransport(handler)
        async with AsyncCompanyBrain(
            api_url="http://test.local", api_key="k", transport=transport
        ) as cb:
            memory = await cb.memories.add("hi")
            frames = [frame async for frame in cb.chat_stream("hello")]
        return memory, frames

    memory, frames = asyncio.run(run())
    assert memory["id"] == "m9"
    assert ("token", "hi") in frames
    assert ("done", "1") in frames


def test_defaults_come_from_env(monkeypatch):
    monkeypatch.setenv("COMPANYBRAIN_API_URL", "http://env.local:9000")
    monkeypatch.setenv("COMPANYBRAIN_API_KEY", "cb_env_key")

    seen = {}

    def handler(request):
        seen["auth"] = request.headers.get("authorization")
        seen["host"] = request.url.host
        seen["port"] = request.url.port
        return httpx.Response(200, json={"memory": {"id": "e1"}})

    cb = CompanyBrain(transport=httpx.MockTransport(handler))
    assert cb.api_url == "http://env.local:9000"
    cb.memories.add("x")
    cb.close()

    assert seen["auth"] == "Bearer cb_env_key"
    assert seen["host"] == "env.local"
    assert seen["port"] == 9000
