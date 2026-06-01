from __future__ import annotations

import os
from pathlib import Path


def _parse_csv_env(value: str | None, default: list[str]) -> list[str]:
    if value is None or not value.strip():
        return default
    items = [item.strip() for item in value.split(",") if item.strip()]
    return items or default


def _parse_int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return max(0, int(raw.strip()))
    except ValueError:
        return default

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("FIELDOBS_DATA_DIR", BASE_DIR / "data")).resolve()
BACKUP_DIR = Path(os.getenv("FIELDOBS_BACKUP_DIR", DATA_DIR / "backups")).resolve()
DEFAULT_LAYER = os.getenv("FIELDOBS_DEFAULT_LAYER", "")
FIELDOBS_CORS_ORIGINS = _parse_csv_env(
    os.getenv("FIELDOBS_CORS_ORIGINS"),
    ["http://127.0.0.1:8000", "http://localhost:8000"],
)
FIELDOBS_API_KEY = os.getenv("FIELDOBS_API_KEY", "").strip()
FIELDOBS_MAX_FEATURES = _parse_int_env("FIELDOBS_MAX_FEATURES", 2000)
FIELDOBS_BACKUP_RETENTION_DAYS = _parse_int_env("FIELDOBS_BACKUP_RETENTION_DAYS", 30)
FIELDOBS_BACKUP_RETENTION_COUNT = _parse_int_env("FIELDOBS_BACKUP_RETENTION_COUNT", 30)

# Curated attributes that are safe to edit in the first MVP.
PREFERRED_EDITABLE_FIELDS = [
    "obs",
    "observation",
    "notation",
    "type",
    "status",
    "intensity",
    "certainty",
    "start_date",
    "end_date",
    "notes",
    "comment",
]
