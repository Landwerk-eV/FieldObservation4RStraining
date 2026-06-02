from __future__ import annotations

import json

import geopandas as gpd
import pandas as pd

from .io import detect_key_field, load_layer
from .models import DiffResult, FeatureDiff

FIELD_ALIASES = {
    "management_activity": "management",
}


def diff_datasets(
    base_path: str,
    candidate_path: str,
    layer_name: str | None = None,
    key_field: str | None = None,
) -> DiffResult:
    base_gdf, base_layer, _ = load_layer(base_path, layer_name)
    candidate_gdf, candidate_layer, _ = load_layer(candidate_path, layer_name)

    resolved_key_field = key_field or detect_key_field(
        [column for column in base_gdf.columns if column != "geometry"],
        base_gdf.index.name,
    )
    if not resolved_key_field:
        raise ValueError("Could not detect a stable key field; pass --key-field explicitly")
    if not _has_key_field(base_gdf, resolved_key_field):
        raise ValueError(f"Key field '{resolved_key_field}' not found in base dataset")
    if not _has_key_field(candidate_gdf, resolved_key_field):
        raise ValueError(f"Key field '{resolved_key_field}' not found in candidate dataset")

    base_index = _index_features(base_gdf, resolved_key_field)
    candidate_index = _index_features(candidate_gdf, resolved_key_field)
    all_keys = sorted(set(base_index) | set(candidate_index), key=str)

    changes: list[FeatureDiff] = []
    counts = {
        "unchanged": 0,
        "added": 0,
        "deleted": 0,
        "attribute_only": 0,
        "geometry_only": 0,
        "attribute_and_geometry": 0,
    }

    for key in all_keys:
        base_feature = base_index.get(key)
        candidate_feature = candidate_index.get(key)
        if base_feature is None:
            status = "added"
            changed_fields: list[str] = []
        elif candidate_feature is None:
            status = "deleted"
            changed_fields = []
        else:
            changed_fields = sorted(
                field
                for field in set(base_feature["properties"]) | set(candidate_feature["properties"])
                if not _values_equivalent(
                    base_feature["properties"].get(field),
                    candidate_feature["properties"].get(field),
                )
            )
            geometry_changed = base_feature["geometry_wkb"] != candidate_feature["geometry_wkb"]
            if changed_fields and geometry_changed:
                status = "attribute_and_geometry"
            elif changed_fields:
                status = "attribute_only"
            elif geometry_changed:
                status = "geometry_only"
            else:
                status = "unchanged"

        counts[status] += 1
        if status != "unchanged":
            changes.append(FeatureDiff(key=str(key), status=status, changed_fields=changed_fields))

    return DiffResult(
        base_path=base_path,
        candidate_path=candidate_path,
        base_layer=base_layer,
        candidate_layer=candidate_layer,
        key_field=resolved_key_field,
        counts=counts,
        changes=changes,
    )


def _index_features(gdf: gpd.GeoDataFrame, key_field: str) -> dict[str, dict]:
    index: dict[str, dict] = {}
    for feature_index, row in gdf.iterrows():
        key_value = _extract_key_value(gdf, row, feature_index, key_field)
        if key_value is None:
            raise ValueError(f"Feature without key value in '{key_field}'")
        key = str(key_value)
        if key in index:
            raise ValueError(f"Duplicate feature key '{key}' in '{key_field}'")
        properties = {
            _canonical_field_name(column): _normalize_value(row.get(column))
            for column in gdf.columns
            if column != "geometry" and _canonical_field_name(column) != key_field.lower()
        }
        geometry = row.geometry
        index[key] = {
            "properties": properties,
            "geometry_wkb": geometry.wkb_hex if geometry is not None else None,
        }
    return index


def _normalize_value(value):
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    if isinstance(value, float) and pd.isna(value):
        return None
    try:
        if pd.isna(value):
            return None
    except TypeError:
        pass
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True)
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


def _canonical_field_name(field_name: str) -> str:
    return FIELD_ALIASES.get(field_name.lower(), field_name.lower())


def _values_equivalent(left, right) -> bool:
    return _normalize_value(left) == _normalize_value(right)


def _extract_key_value(gdf: gpd.GeoDataFrame, row, feature_index, key_field: str):
    index_name = gdf.index.name or ""
    if key_field.lower() == index_name.lower():
        return feature_index
    return row.get(key_field)


def _has_key_field(gdf: gpd.GeoDataFrame, key_field: str) -> bool:
    index_name = gdf.index.name or ""
    return key_field in gdf.columns or key_field.lower() == index_name.lower()