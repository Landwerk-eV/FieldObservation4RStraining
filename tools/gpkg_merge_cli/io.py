from __future__ import annotations

from pathlib import Path

import fiona
import geopandas as gpd

from .models import DatasetSummary

KEY_FIELD_CANDIDATES = ("uuid", "feature_uuid", "objectid", "fid", "id")


def inspect_dataset(dataset_path: str, layer_name: str | None = None) -> DatasetSummary:
    resolved_path = _resolve_dataset_path(dataset_path)
    layers = list(fiona.listlayers(resolved_path))
    layer = _resolve_layer(layers, layer_name)
    gdf = gpd.read_file(resolved_path, layer=layer, fid_as_index=True)
    columns = [column for column in gdf.columns if column != "geometry"]
    key_field = detect_key_field(columns, gdf.index.name)
    return DatasetSummary(
        dataset_path=str(resolved_path),
        layer=layer,
        layers=layers,
        feature_count=len(gdf),
        columns=columns,
        crs=str(gdf.crs) if gdf.crs else None,
        key_field=key_field,
    )


def load_layer(dataset_path: str, layer_name: str | None = None) -> tuple[gpd.GeoDataFrame, str, list[str]]:
    resolved_path = _resolve_dataset_path(dataset_path)
    layers = list(fiona.listlayers(resolved_path))
    layer = _resolve_layer(layers, layer_name)
    gdf = gpd.read_file(resolved_path, layer=layer, fid_as_index=True)
    return gdf, layer, layers


def detect_key_field(columns: list[str], index_name: str | None = None) -> str | None:
    lowered = {column.lower(): column for column in columns}
    if index_name and index_name.lower() in KEY_FIELD_CANDIDATES:
        return index_name
    for candidate in KEY_FIELD_CANDIDATES:
        if candidate in lowered:
            return lowered[candidate]
    return None


def _resolve_dataset_path(dataset_path: str) -> Path:
    path = Path(dataset_path).expanduser().resolve()
    if path.suffix.lower() != ".gpkg":
        raise ValueError(f"Expected a .gpkg file: {dataset_path}")
    if not path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")
    return path


def _resolve_layer(layers: list[str], layer_name: str | None) -> str:
    if layer_name:
        if layer_name not in layers:
            raise ValueError(f"Layer '{layer_name}' not found")
        return layer_name
    if not layers:
        raise ValueError("GeoPackage contains no layers")
    return layers[0]