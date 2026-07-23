"""Synchronous CompanyBrain client.

    from companybrain import CompanyBrain

    cb = CompanyBrain(api_key="cb_...")
    cb.memories.add(content="We ship on Thursdays.")
    hits = cb.search("when do we ship")["hits"]
"""

from __future__ import annotations

from typing import Any, Dict, Iterator, List, Optional, Tuple

import httpx

from . import _common as _c
from ._common import CompanyBrainError
from .types import (
    ApiKey,
    ApiKeyWithSecret,
    AvailableConnectors,
    ChatMessage,
    ChatResponse,
    ConnectionList,
    Memory,
    MemoryList,
    SearchResponse,
    Space,
    SyncResult,
)


class CompanyBrain:
    """Synchronous client for the CompanyBrain HTTP API."""

    def __init__(
        self,
        *,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: float = 30.0,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self.api_url = _c.resolve_api_url(api_url)
        self._api_key = _c.resolve_api_key(api_key)
        self._http = httpx.Client(
            base_url=self.api_url,
            headers=_c.build_headers(self._api_key, headers),
            timeout=timeout,
            transport=transport,
        )
        self.memories = MemoriesResource(self)
        self.spaces = SpacesResource(self)
        self.connections = ConnectionsResource(self)
        self.api_keys = ApiKeysResource(self)

    # --- lifecycle -------------------------------------------------------
    def close(self) -> None:
        self._http.close()

    def __enter__(self) -> "CompanyBrain":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    # --- low-level request ----------------------------------------------
    def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Any:
        response = self._http.request(method, path, params=params or None, json=json)
        return _handle(response)

    # --- top-level operations -------------------------------------------
    def search(
        self,
        q: str,
        *,
        mode: Optional[str] = None,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        limit: Optional[int] = None,
        tags: Optional[List[str]] = None,
        min_score: Optional[float] = None,
    ) -> SearchResponse:
        body = _c.search_body(
            q=q,
            mode=mode,
            space=space,
            space_id=space_id,
            limit=limit,
            tags=tags,
            min_score=min_score,
        )
        return self.request("POST", "/v1/search", json=body)

    def chat(
        self,
        message: str,
        *,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        limit: Optional[int] = None,
        history: Optional[List[ChatMessage]] = None,
    ) -> ChatResponse:
        body = _c.chat_body(
            message=message,
            space=space,
            space_id=space_id,
            limit=limit,
            history=history,
        )
        return self.request("POST", "/v1/chat", json=body)

    def chat_stream(
        self,
        message: str,
        *,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        limit: Optional[int] = None,
        history: Optional[List[ChatMessage]] = None,
    ) -> Iterator[Tuple[str, str]]:
        """Stream a chat answer over SSE, yielding ``(event, data)`` frames.

        Events are ``citations`` (JSON string), ``token`` (text), then ``done``.
        """
        body = _c.chat_body(
            message=message,
            space=space,
            space_id=space_id,
            limit=limit,
            history=history,
        )
        with self._http.stream("POST", "/v1/chat/stream", json=body) as response:
            if not response.is_success:
                response.read()
                raise error_from_response(response)
            buffer = _c.SSEBuffer()
            for chunk in response.iter_text():
                for frame in buffer.push(chunk):
                    yield frame
            for frame in buffer.flush():
                yield frame

    def status(self) -> Dict[str, Any]:
        return self.request("GET", "/v1/status")

    def playbook(
        self,
        topic: str,
        *,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        limit: Optional[int] = None,
        save: bool = False,
    ) -> Dict[str, Any]:
        """Synthesize a cited playbook from the memories on a topic."""
        body: Dict[str, Any] = {"topic": topic}
        if space is not None:
            body["space"] = space
        if space_id is not None:
            body["spaceId"] = space_id
        if limit is not None:
            body["limit"] = limit
        if save:
            body["save"] = True
        return self.request("POST", "/v1/playbooks", json=body)

    def topics(
        self,
        *,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        limit: Optional[int] = None,
        min_count: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Group memories by tag to surface projects, people, and themes."""
        params: Dict[str, Any] = {}
        if space is not None:
            params["space"] = space
        if space_id is not None:
            params["spaceId"] = space_id
        if limit is not None:
            params["limit"] = limit
        if min_count is not None:
            params["minCount"] = min_count
        return self.request("GET", "/v1/topics", params=params)


class MemoriesResource:
    def __init__(self, client: CompanyBrain) -> None:
        self._client = client

    def add(
        self,
        content: str,
        *,
        title: Optional[str] = None,
        format: Optional[str] = None,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
        source_url: Optional[str] = None,
        source_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        body = _c.memory_body(
            content=content,
            title=title,
            format=format,
            space=space,
            space_id=space_id,
            tags=tags,
            source_url=source_url,
            source_type=source_type,
            metadata=metadata,
        )
        return self._client.request("POST", "/v1/memories", json=body)["memory"]

    def list(
        self,
        *,
        limit: Optional[int] = None,
        offset: Optional[int] = None,
        space_id: Optional[str] = None,
        connector: Optional[str] = None,
    ) -> MemoryList:
        params = _c.memory_query(
            limit=limit, offset=offset, space_id=space_id, connector=connector
        )
        return self._client.request("GET", "/v1/memories", params=params)

    def get(self, memory_id: str) -> Memory:
        return self._client.request("GET", f"/v1/memories/{memory_id}")["memory"]

    def update(
        self,
        memory_id: str,
        *,
        content: Optional[str] = None,
        title: Optional[str] = None,
        format: Optional[str] = None,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
        source_url: Optional[str] = None,
        source_type: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Memory:
        body = _c.memory_body(
            content=content,
            title=title,
            format=format,
            space=space,
            space_id=space_id,
            tags=tags,
            source_url=source_url,
            source_type=source_type,
            metadata=metadata,
        )
        return self._client.request("PATCH", f"/v1/memories/{memory_id}", json=body)["memory"]

    def delete(self, memory_id: str) -> bool:
        return self._client.request("DELETE", f"/v1/memories/{memory_id}")["deleted"]


class SpacesResource:
    def __init__(self, client: CompanyBrain) -> None:
        self._client = client

    def list(self) -> List[Space]:
        return self._client.request("GET", "/v1/spaces")["spaces"]

    def create(
        self,
        name: str,
        *,
        slug: Optional[str] = None,
        description: Optional[str] = None,
        icon: Optional[str] = None,
        color: Optional[str] = None,
    ) -> Space:
        body = _c.space_body(
            name=name, slug=slug, description=description, icon=icon, color=color
        )
        return self._client.request("POST", "/v1/spaces", json=body)["space"]

    def delete(self, space_id: str) -> bool:
        return self._client.request("DELETE", f"/v1/spaces/{space_id}")["deleted"]


class ConnectionsResource:
    def __init__(self, client: CompanyBrain) -> None:
        self._client = client

    def available(self) -> AvailableConnectors:
        return self._client.request("GET", "/v1/connections/available")

    def list(self) -> ConnectionList:
        return self._client.request("GET", "/v1/connections")

    def create(
        self,
        connector: str,
        name: str,
        *,
        space_id: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
        credentials: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        body = _c.connection_body(
            connector=connector,
            name=name,
            space_id=space_id,
            config=config,
            credentials=credentials,
        )
        return self._client.request("POST", "/v1/connections", json=body)

    def sync(self, connection_id: str) -> SyncResult:
        return self._client.request("POST", f"/v1/connections/{connection_id}/sync")


class ApiKeysResource:
    def __init__(self, client: CompanyBrain) -> None:
        self._client = client

    def list(self) -> List[ApiKey]:
        return self._client.request("GET", "/v1/api-keys")["keys"]

    def create(self, name: str) -> ApiKeyWithSecret:
        return self._client.request("POST", "/v1/api-keys", json={"name": name})["key"]

    def revoke(self, key_id: str) -> bool:
        return self._client.request("DELETE", f"/v1/api-keys/{key_id}")["revoked"]


def _handle(response: httpx.Response) -> Any:
    data = _read_json(response)
    if not response.is_success:
        raise _c.error_from(response.status_code, data)
    return data


def _read_json(response: httpx.Response) -> Any:
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text


def error_from_response(response: httpx.Response) -> CompanyBrainError:
    return _c.error_from(response.status_code, _read_json(response))
