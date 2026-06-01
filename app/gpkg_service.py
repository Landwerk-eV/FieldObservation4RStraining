from __future__ import annotations

import json
import shutil
import tempfile
import threading
from datetime import datetime
from pathlib import Path

import fiona
import geopandas as gpd

from .config import (
    BACKUP_DIR,
    DATA_DIR,
    DEFAULT_LAYER,
    FIELDOBS_BACKUP_RETENTION_COUNT,
    FIELDOBS_BACKUP_RETENTION_DAYS,
    FIELDOBS_MAX_FEATURES,
    PREFERRED_EDITABLE_FIELDS,
)
from .validation import validate_feature_collection_properties


class GeoPackageService:
    """Service for listing, reading, and writing GeoPackage polygon layers."""

    def __init__(self) -> None:
        self._write_lock = threading.Lock()

    def list_datasets(self) -> list[str]:
        if not DATA_DIR.exists():
            return []
        return sorted([p.name for p in DATA_DIR.glob("*.gpkg")])

    def inspect(self, dataset_name: str) -> dict:
        dataset_path = self._resolve_dataset(dataset_name)
        layers = list(fiona.listlayers(dataset_path))
        layer = self._resolve_layer(layers)
        gdf = gpd.read_file(dataset_path, layer=layer)

        columns = [col for col in gdf.columns if col != "geometry"]
        editable = [field for field in PREFERRED_EDITABLE_FIELDS if field in columns]
        if not editable:
            editable = [col for col in columns if not col.lower().startswith(("id", "fid"))][:8]

        return {
            "dataset": dataset_name,
            "layer": layer,
            "layers": layers,
            "feature_count": len(gdf),
            "columns": columns,
            "editable_fields": editable,
            "crs": str(gdf.crs) if gdf.crs else None,
        }

    def read_features(self, dataset_name: str, layer_name: str | None = None) -> dict:
        dataset_path = self._resolve_dataset(dataset_name)
        layers = list(fiona.listlayers(dataset_path))
        layer = layer_name or self._resolve_layer(layers)

        gdf = gpd.read_file(dataset_path, layer=layer)
        if gdf.crs is not None and gdf.crs.to_string() != "EPSG:4326":
            gdf = gdf.to_crs("EPSG:4326")

        payload = json.loads(gdf.to_json(drop_id=False))
        meta = self.inspect(dataset_name)
        payload["meta"] = {
            "dataset": dataset_name,
            "layer": layer,
            "editable_fields": meta["editable_fields"],
        }
        return payload

    def save_features(
        self,
        dataset_name: str,
        feature_collection: dict,
        layer_name: str | None = None,
    ) -> dict:
        if feature_collection.get("type") != "FeatureCollection":
            raise ValueError("Payload must be a GeoJSON FeatureCollection")

        dataset_path = self._resolve_dataset(dataset_name)
        layers = list(fiona.listlayers(dataset_path))
        layer = layer_name or self._resolve_layer(layers)
        if layer not in layers:
            raise ValueError(f"Layer '{layer}' not found")

        features = feature_collection.get("features", [])
        if len(features) > FIELDOBS_MAX_FEATURES:
            raise ValueError(
                f"FeatureCollection exceeds the configured limit of {FIELDOBS_MAX_FEATURES} features"
            )

        with self._write_lock:
            existing_layers = {
                existing: gpd.read_file(dataset_path, layer=existing) for existing in layers
            }
            target_crs = existing_layers[layer].crs or "EPSG:4326"

            validate_feature_collection_properties(features)

            updated = gpd.GeoDataFrame.from_features(
                features, crs="EPSG:4326"
            )
            updated = updated[updated.geometry.notna()]
            updated = updated[updated.geometry.is_valid]
            if updated.crs is None:
                updated.set_crs("EPSG:4326", inplace=True)
            if target_crs:
                updated = updated.to_crs(target_crs)
            existing_layers[layer] = updated

            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_path = BACKUP_DIR / f"{dataset_path.stem}.{timestamp}.gpkg"
            shutil.copy2(dataset_path, backup_path)

            tmp_file = Path(tempfile.mkstemp(suffix=".gpkg", prefix="fieldobs-")[1])
            try:
                first = True
                for layer_name_write, layer_gdf in existing_layers.items():
                    mode = "w" if first else "a"
                    layer_gdf.to_file(
                        tmp_file,
                        layer=layer_name_write,
                        driver="GPKG",
                        mode=mode,
                    )
                    first = False
                shutil.move(tmp_file, dataset_path)
                self._cleanup_backups(dataset_path.stem)
            finally:
                if tmp_file.exists():
                    tmp_file.unlink(missing_ok=True)

            return {
                "dataset": dataset_name,
                "layer": layer,
                "feature_count": len(updated),
                "backup": str(backup_path),
            }

    def _resolve_dataset(self, dataset_name: str) -> Path:
        dataset_path = (DATA_DIR / dataset_name).resolve()
        if DATA_DIR not in dataset_path.parents or dataset_path.suffix.lower() != ".gpkg":
            raise ValueError("Invalid dataset path")
        if not dataset_path.exists():
            raise FileNotFoundError(f"Dataset not found: {dataset_name}")
        return dataset_path

    def _resolve_layer(self, layers: list[str]) -> str:
        if DEFAULT_LAYER and DEFAULT_LAYER in layers:
            return DEFAULT_LAYER
        if not layers:
            raise ValueError("GeoPackage contains no layers")
        return layers[0]

    def _cleanup_backups(self, dataset_stem: str) -> None:
        if not BACKUP_DIR.exists():
            return

        backups = list(BACKUP_DIR.glob(f"{dataset_stem}.*.gpkg"))
        if not backups:
            return

        retained: list[tuple[float, Path]] = []
        cutoff = None
        if FIELDOBS_BACKUP_RETENTION_DAYS > 0:
            cutoff = datetime.now().timestamp() - (FIELDOBS_BACKUP_RETENTION_DAYS * 86400)

        for backup_path in backups:
            try:
                modified_time = backup_path.stat().st_mtime
            except OSError:
                continue

            if cutoff is not None and modified_time < cutoff:
                backup_path.unlink(missing_ok=True)
                continue

            retained.append((modified_time, backup_path))

        if FIELDOBS_BACKUP_RETENTION_COUNT <= 0:
            return

        retained.sort(key=lambda item: item[0], reverse=True)
        for _, backup_path in retained[FIELDOBS_BACKUP_RETENTION_COUNT :]:
            backup_path.unlink(missing_ok=True)
