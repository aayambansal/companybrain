"""Official Python SDK for CompanyBrain, the open-source memory layer.

    from companybrain import CompanyBrain

    cb = CompanyBrain(api_key="cb_...")            # or COMPANYBRAIN_API_KEY
    cb.memories.add(content="We ship on Thursdays.")
    hits = cb.search("when do we ship")["hits"]
"""

from __future__ import annotations

from ._common import CompanyBrainError
from .async_client import AsyncCompanyBrain
from .client import CompanyBrain
from .types import (
    ApiKey,
    ApiKeyWithSecret,
    AvailableConnectors,
    ChatMessage,
    ChatResponse,
    Citation,
    ConnectionList,
    ConnectorInfo,
    Memory,
    MemoryFormat,
    MemoryList,
    MemoryStatus,
    Role,
    ScoreBreakdown,
    SearchHit,
    SearchHitDocument,
    SearchMode,
    SearchResponse,
    Space,
    SyncResult,
)

__version__ = "0.1.0"

__all__ = [
    "CompanyBrain",
    "AsyncCompanyBrain",
    "CompanyBrainError",
    "ApiKey",
    "ApiKeyWithSecret",
    "AvailableConnectors",
    "ChatMessage",
    "ChatResponse",
    "Citation",
    "ConnectionList",
    "ConnectorInfo",
    "Memory",
    "MemoryFormat",
    "MemoryList",
    "MemoryStatus",
    "Role",
    "ScoreBreakdown",
    "SearchHit",
    "SearchHitDocument",
    "SearchMode",
    "SearchResponse",
    "Space",
    "SyncResult",
    "__version__",
]
