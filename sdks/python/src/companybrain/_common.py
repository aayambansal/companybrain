"""Internal helpers shared by the sync and async clients.

Env resolution, header/body construction, error mapping, and SSE parsing all
live here so the two client implementations stay thin and identical in
behaviour.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple

DEFAULT_API_URL = "http://localhost:3333"


class CompanyBrainError(Exception):
    """Raised for any non-2xx response from the API.

    ``code`` and ``details`` mirror the API's ``{error, message, issues}``
    envelope: ``code`` is the machine-readable ``error`` string and ``details``
    holds validation ``issues`` when present.
    """

    def __init__(
        self,
        status: int,
        code: Optional[str],
        message: str,
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.details = details

    def __str__(self) -> str:
        prefix = f"[{self.status}]"
        if self.code:
            prefix += f" {self.code}"
        return f"{prefix} {self.message}"


def resolve_api_url(api_url: Optional[str]) -> str:
    url = api_url or os.environ.get("COMPANYBRAIN_API_URL") or DEFAULT_API_URL
    return url.rstrip("/")


def resolve_api_key(api_key: Optional[str]) -> Optional[str]:
    return api_key or os.environ.get("COMPANYBRAIN_API_KEY")


def build_headers(
    api_key: Optional[str],
    extra: Optional[Dict[str, str]],
) -> Dict[str, str]:
    headers: Dict[str, str] = {"Accept": "application/json"}
    if extra:
        headers.update(extra)
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


def compact(data: Dict[str, Any]) -> Dict[str, Any]:
    """Drop keys whose value is ``None`` so they are omitted from the request."""
    return {k: v for k, v in data.items() if v is not None}


def error_from(status: int, data: Any) -> CompanyBrainError:
    if isinstance(data, dict):
        message = data.get("message") or data.get("error") or f"Request failed ({status})"
        return CompanyBrainError(status, data.get("error"), message, data.get("issues"))
    return CompanyBrainError(status, None, f"Request failed ({status})", data)


# --- request body / query builders --------------------------------------

def memory_body(
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
) -> Dict[str, Any]:
    return compact(
        {
            "content": content,
            "title": title,
            "format": format,
            "space": space,
            "spaceId": space_id,
            "tags": tags,
            "sourceUrl": source_url,
            "sourceType": source_type,
            "metadata": metadata,
        }
    )


def memory_query(
    *,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
    space_id: Optional[str] = None,
    connector: Optional[str] = None,
) -> Dict[str, Any]:
    return compact(
        {
            "limit": limit,
            "offset": offset,
            "spaceId": space_id,
            "connector": connector,
        }
    )


def search_body(
    *,
    q: str,
    mode: Optional[str] = None,
    space: Optional[str] = None,
    space_id: Optional[str] = None,
    limit: Optional[int] = None,
    tags: Optional[List[str]] = None,
    min_score: Optional[float] = None,
) -> Dict[str, Any]:
    return compact(
        {
            "q": q,
            "mode": mode,
            "space": space,
            "spaceId": space_id,
            "limit": limit,
            "tags": tags,
            "minScore": min_score,
        }
    )


def chat_body(
    *,
    message: str,
    space: Optional[str] = None,
    space_id: Optional[str] = None,
    limit: Optional[int] = None,
    history: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    return compact(
        {
            "message": message,
            "space": space,
            "spaceId": space_id,
            "limit": limit,
            "history": history,
        }
    )


def space_body(
    *,
    name: str,
    slug: Optional[str] = None,
    description: Optional[str] = None,
    icon: Optional[str] = None,
    color: Optional[str] = None,
) -> Dict[str, Any]:
    return compact(
        {
            "name": name,
            "slug": slug,
            "description": description,
            "icon": icon,
            "color": color,
        }
    )


def connection_body(
    *,
    connector: str,
    name: str,
    space_id: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    credentials: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return compact(
        {
            "connector": connector,
            "name": name,
            "spaceId": space_id,
            "config": config,
            "credentials": credentials,
        }
    )


# --- server-sent events --------------------------------------------------

def parse_sse_frame(frame: str) -> Optional[Tuple[str, str]]:
    """Parse one ``\\n\\n``-delimited SSE frame into ``(event, data)``.

    Returns ``None`` for frames that carry no data (comments, keep-alives).
    """
    event = "message"
    data = ""
    for line in frame.split("\n"):
        if line.startswith("event:"):
            event = line[6:].strip()
        elif line.startswith("data:"):
            data += line[5:].strip()
    if not data:
        return None
    return event, data


class SSEBuffer:
    """Accumulates streamed text and emits complete SSE frames."""

    def __init__(self) -> None:
        self._buffer = ""

    def push(self, chunk: str) -> List[Tuple[str, str]]:
        self._buffer += chunk
        frames: List[Tuple[str, str]] = []
        while "\n\n" in self._buffer:
            raw, self._buffer = self._buffer.split("\n\n", 1)
            parsed = parse_sse_frame(raw)
            if parsed is not None:
                frames.append(parsed)
        return frames

    def flush(self) -> List[Tuple[str, str]]:
        remainder, self._buffer = self._buffer, ""
        if not remainder.strip():
            return []
        parsed = parse_sse_frame(remainder)
        return [parsed] if parsed is not None else []


def decode_stream_frame(frame: Tuple[str, str]) -> Tuple[str, str]:
    """Decode a ``token`` frame's JSON-encoded payload back to text.

    The server JSON-encodes token data so significant whitespace and newlines
    survive SSE line framing. Citations stay a JSON string for the caller to
    parse. Falls back to the raw value for older servers or malformed frames.
    """
    event, data = frame
    if event == "token":
        try:
            decoded = json.loads(data)
        except ValueError:
            return frame
        if isinstance(decoded, str):
            return (event, decoded)
    return frame
