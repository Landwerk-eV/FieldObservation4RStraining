from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class DatasetSummary:
    dataset_path: str
    layer: str
    layers: list[str]
    feature_count: int
    columns: list[str]
    crs: str | None
    key_field: str | None


@dataclass(slots=True)
class FeatureDiff:
    key: str
    status: str
    changed_fields: list[str] = field(default_factory=list)


@dataclass(slots=True)
class DiffResult:
    base_path: str
    candidate_path: str
    base_layer: str
    candidate_layer: str
    key_field: str
    counts: dict[str, int]
    changes: list[FeatureDiff]