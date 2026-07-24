"""Unit tests for the client-side SSE stream parsing (no live API required)."""

from __future__ import annotations

import json

from companybrain._common import SSEBuffer, decode_stream_frame, parse_sse_frame


def test_parse_sse_frame_reads_event_and_data():
    assert parse_sse_frame("event: token\ndata: hello") == ("token", "hello")


def test_parse_sse_frame_defaults_event_to_message():
    assert parse_sse_frame("data: hi") == ("message", "hi")


def test_parse_sse_frame_returns_none_without_data():
    assert parse_sse_frame(": keep-alive comment") is None
    assert parse_sse_frame("") is None
    assert parse_sse_frame("event: done") is None  # event line but no data


def test_parse_sse_frame_concatenates_multiple_data_lines():
    assert parse_sse_frame("data: a\ndata: b") == ("message", "ab")


def test_ssebuffer_emits_a_complete_frame():
    buf = SSEBuffer()
    assert buf.push("event: token\ndata: hi\n\n") == [("token", "hi")]


def test_ssebuffer_reassembles_a_frame_split_across_chunks():
    buf = SSEBuffer()
    assert buf.push("event: token\nda") == []  # arrives mid-frame
    assert buf.push("ta: hi\n\n") == [("token", "hi")]  # completed on next chunk


def test_ssebuffer_emits_multiple_frames_from_one_push():
    buf = SSEBuffer()
    assert buf.push("data: one\n\ndata: two\n\n") == [
        ("message", "one"),
        ("message", "two"),
    ]


def test_ssebuffer_flush_emits_a_trailing_unterminated_frame():
    buf = SSEBuffer()
    assert buf.push("event: token\ndata: last") == []  # no trailing \n\n yet
    assert buf.flush() == [("token", "last")]


def test_ssebuffer_flush_ignores_blank_remainder():
    buf = SSEBuffer()
    buf.push("data: x\n\n")
    assert buf.flush() == []


def test_decode_stream_frame_json_decodes_a_token_payload():
    # The server JSON-encodes token data so newlines survive SSE framing.
    frame = ("token", json.dumps("hello\nworld"))
    assert decode_stream_frame(frame) == ("token", "hello\nworld")


def test_decode_stream_frame_passes_non_token_events_through():
    assert decode_stream_frame(("citations", "[1,2]")) == ("citations", "[1,2]")


def test_decode_stream_frame_falls_back_on_malformed_json():
    assert decode_stream_frame(("token", "not json")) == ("token", "not json")
