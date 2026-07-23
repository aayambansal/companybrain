"""Response shapes returned by the CompanyBrain API.

These mirror the JSON payloads verbatim, so keys stay camelCase (``spaceId``,
``sourceUrl``, ...). Method arguments on the clients use snake_case and are
mapped to these keys before the request is sent.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from typing import Literal, TypedDict

SearchMode = Literal["hybrid", "semantic", "keyword"]
MemoryFormat = Literal["text", "markdown", "html"]
MemoryStatus = Literal["pending", "processing", "indexed", "failed"]
Role = Literal["user", "assistant"]


class Memory(TypedDict):
    id: str
    spaceId: str
    title: Optional[str]
    content: Optional[str]
    summary: Optional[str]
    connector: str
    sourceType: Optional[str]
    sourceUrl: Optional[str]
    tags: List[str]
    metadata: Dict[str, Any]
    status: MemoryStatus
    createdAt: str
    updatedAt: str


class MemoryList(TypedDict):
    memories: List[Memory]
    total: int
    limit: int
    offset: int


class _ScoreBreakdown(TypedDict):
    fused: float


class ScoreBreakdown(_ScoreBreakdown, total=False):
    vector: float
    keyword: float


class SearchHitDocument(TypedDict):
    id: str
    title: Optional[str]
    sourceUrl: Optional[str]
    connector: str
    tags: List[str]


class SearchHit(TypedDict):
    chunkId: str
    documentId: str
    spaceId: str
    score: float
    scores: ScoreBreakdown
    content: str
    chunkIndex: int
    document: SearchHitDocument
    metadata: Dict[str, Any]


class SearchResponse(TypedDict):
    query: str
    mode: SearchMode
    hits: List[SearchHit]
    tookMs: int


class Citation(TypedDict):
    index: int
    chunkId: str
    documentId: str
    title: Optional[str]
    sourceUrl: Optional[str]
    snippet: str


class ChatMessage(TypedDict):
    role: Role
    content: str


class ChatResponse(TypedDict):
    message: str
    citations: List[Citation]
    usedHits: List[SearchHit]


class _Space(TypedDict):
    id: str
    name: str
    slug: str
    description: Optional[str]
    icon: Optional[str]
    color: Optional[str]
    isDefault: bool
    createdAt: str


class Space(_Space, total=False):
    documentCount: int


class _ConnectorInfo(TypedDict):
    id: str
    displayName: str
    description: str
    configSchema: List[Any]


class ConnectorInfo(_ConnectorInfo, total=False):
    category: str
    auth: str


class AvailableConnectors(TypedDict):
    connectors: List[ConnectorInfo]


class ConnectionList(TypedDict):
    connections: List[Dict[str, Any]]


class SyncResult(TypedDict):
    started: bool
    syncRunId: str


class ApiKey(TypedDict):
    id: str
    name: str
    prefix: str
    lastUsedAt: Optional[str]
    createdAt: str
    revokedAt: Optional[str]


class ApiKeyWithSecret(ApiKey):
    secret: str


__all__ = [
    "SearchMode",
    "MemoryFormat",
    "MemoryStatus",
    "Role",
    "Memory",
    "MemoryList",
    "ScoreBreakdown",
    "SearchHitDocument",
    "SearchHit",
    "SearchResponse",
    "Citation",
    "ChatMessage",
    "ChatResponse",
    "Space",
    "ConnectorInfo",
    "AvailableConnectors",
    "ConnectionList",
    "SyncResult",
    "ApiKey",
    "ApiKeyWithSecret",
]
