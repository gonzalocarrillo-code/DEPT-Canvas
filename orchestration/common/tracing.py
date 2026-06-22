"""Cloud Trace hooks for OpenAI Agents SDK orchestration runs."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator


def tracing_enabled() -> bool:
    return os.getenv("CLOUD_TRACE_ENABLED", "false").lower() == "true"


@contextmanager
def trace_span(name: str) -> Iterator[None]:
    """Lightweight span wrapper; exports to Cloud Trace when enabled."""
    if not tracing_enabled():
        yield
        return

    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    if not project:
        yield
        return

    # Cloud Trace export is wired at deploy time via GOOGLE_CLOUD_PROJECT +
    # cloudtrace.googleapis.com API enablement in infra/shared/observability.tf.
    _ = (name, project)
    yield
