"""Asynchronous CompanyBrain client.

    from companybrain import AsyncCompanyBrain

    async with AsyncCompanyBrain(api_key="cb_...") as cb:
        await cb.memories.add(content="We ship on Thursdays.")
        result = await cb.search("when do we ship")
"""

from __future__ import annotations

import asyncio
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

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


class AsyncCompanyBrain:
    """Asynchronous client for the CompanyBrain HTTP API."""

    def __init__(
        self,
        *,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: float = 30.0,
        max_retries: int = 2,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ) -> None:
        self.api_url = _c.resolve_api_url(api_url)
        self._api_key = _c.resolve_api_key(api_key)
        self._max_retries = max(0, max_retries)
        self._http = httpx.AsyncClient(
            base_url=self.api_url,
            headers=_c.build_headers(self._api_key, headers),
            timeout=timeout,
            transport=transport,
        )
        self.memories = AsyncMemoriesResource(self)
        self.spaces = AsyncSpacesResource(self)
        self.connections = AsyncConnectionsResource(self)
        self.api_keys = AsyncApiKeysResource(self)

    # --- lifecycle -------------------------------------------------------
    async def aclose(self) -> None:
        await self._http.aclose()

    async def __aenter__(self) -> "AsyncCompanyBrain":
        return self

    async def __aexit__(self, *exc: Any) -> None:
        await self.aclose()

    # --- low-level request ----------------------------------------------
    async def request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, Any]] = None,
        json: Optional[Dict[str, Any]] = None,
    ) -> Any:
        for attempt in range(self._max_retries + 1):
            response = await self._http.request(method, path, params=params or None, json=json)
            if (
                response.is_success
                or attempt >= self._max_retries
                or response.status_code not in (429, 503)
            ):
                return _handle(response)
            # Retry a rate-limit / transient response, honoring Retry-After.
            await response.aread()
            retry_after = _c.parse_retry_after(response.headers.get("Retry-After"))
            await asyncio.sleep(min(retry_after if retry_after is not None else 2**attempt, 20))
        return _handle(response)  # pragma: no cover - loop always returns above

    # --- top-level operations -------------------------------------------
    async def search(
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
        return await self.request("POST", "/v1/search", json=body)

    async def chat(
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
        return await self.request("POST", "/v1/chat", json=body)

    async def chat_stream(
        self,
        message: str,
        *,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        limit: Optional[int] = None,
        history: Optional[List[ChatMessage]] = None,
    ) -> AsyncIterator[Tuple[str, str]]:
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
        async with self._http.stream("POST", "/v1/chat/stream", json=body) as response:
            if not response.is_success:
                await response.aread()
                raise await error_from_response(response)
            buffer = _c.SSEBuffer()
            async for chunk in response.aiter_text():
                for frame in buffer.push(chunk):
                    yield _c.decode_stream_frame(frame)
            for frame in buffer.flush():
                yield _c.decode_stream_frame(frame)

    async def status(self) -> Dict[str, Any]:
        return await self.request("GET", "/v1/status")

    async def playbook(
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
        return await self.request("POST", "/v1/playbooks", json=body)

    async def topics(
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
        return await self.request("GET", "/v1/topics", params=params)

    async def digest(
        self,
        *,
        space: Optional[str] = None,
        space_id: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Summarize what recently landed in the brain."""
        params: Dict[str, Any] = {}
        if space is not None:
            params["space"] = space
        if space_id is not None:
            params["spaceId"] = space_id
        if limit is not None:
            params["limit"] = limit
        return await self.request("GET", "/v1/digest", params=params)


class AsyncMemoriesResource:
    def __init__(self, client: AsyncCompanyBrain) -> None:
        self._client = client

    async def add(
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
        return (await self._client.request("POST", "/v1/memories", json=body))["memory"]

    async def list(
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
        return await self._client.request("GET", "/v1/memories", params=params)

    async def get(self, memory_id: str) -> Memory:
        return (await self._client.request("GET", f"/v1/memories/{memory_id}"))["memory"]

    async def update(
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
        response = await self._client.request("PATCH", f"/v1/memories/{memory_id}", json=body)
        return response["memory"]

    async def delete(self, memory_id: str) -> bool:
        return (await self._client.request("DELETE", f"/v1/memories/{memory_id}"))["deleted"]


class AsyncSpacesResource:
    def __init__(self, client: AsyncCompanyBrain) -> None:
        self._client = client

    async def list(self) -> List[Space]:
        return (await self._client.request("GET", "/v1/spaces"))["spaces"]

    async def create(
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
        return (await self._client.request("POST", "/v1/spaces", json=body))["space"]

    async def delete(self, space_id: str) -> bool:
        return (await self._client.request("DELETE", f"/v1/spaces/{space_id}"))["deleted"]


class AsyncConnectionsResource:
    def __init__(self, client: AsyncCompanyBrain) -> None:
        self._client = client

    async def available(self) -> AvailableConnectors:
        return await self._client.request("GET", "/v1/connections/available")

    async def list(self) -> ConnectionList:
        return await self._client.request("GET", "/v1/connections")

    async def create(
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
        return await self._client.request("POST", "/v1/connections", json=body)

    async def sync(self, connection_id: str) -> SyncResult:
        return await self._client.request("POST", f"/v1/connections/{connection_id}/sync")


class AsyncApiKeysResource:
    def __init__(self, client: AsyncCompanyBrain) -> None:
        self._client = client

    async def list(self) -> List[ApiKey]:
        return (await self._client.request("GET", "/v1/api-keys"))["keys"]

    async def create(self, name: str) -> ApiKeyWithSecret:
        return (await self._client.request("POST", "/v1/api-keys", json={"name": name}))["key"]

    async def revoke(self, key_id: str) -> bool:
        return (await self._client.request("DELETE", f"/v1/api-keys/{key_id}"))["revoked"]


def _handle(response: httpx.Response) -> Any:
    data = _read_json(response)
    if not response.is_success:
        retry_after = _c.parse_retry_after(response.headers.get("Retry-After"))
        raise _c.error_from(response.status_code, data, retry_after)
    return data


def _read_json(response: httpx.Response) -> Any:
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text


async def error_from_response(response: httpx.Response) -> CompanyBrainError:
    retry_after = _c.parse_retry_after(response.headers.get("Retry-After"))
    return _c.error_from(response.status_code, _read_json(response), retry_after)
