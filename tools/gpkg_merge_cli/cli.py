from __future__ import annotations

import argparse
import json
from dataclasses import asdict

from .diffing import diff_datasets
from .io import inspect_dataset


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if not hasattr(args, "handler"):
        parser.print_help()
        return 1

    try:
        return args.handler(args)
    except (FileNotFoundError, ValueError) as exc:
        parser.exit(2, f"error: {exc}\n")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="gpkg-merge-cli",
        description="Inspect and diff GeoPackage datasets for editor-in-chief review.",
    )
    subparsers = parser.add_subparsers(dest="command")

    inspect_parser = subparsers.add_parser("inspect", help="Inspect one GeoPackage dataset")
    inspect_parser.add_argument("dataset", help="Path to the GeoPackage file")
    inspect_parser.add_argument("--layer", help="Layer name to inspect")
    inspect_parser.add_argument("--json", action="store_true", help="Emit JSON output")
    inspect_parser.set_defaults(handler=_handle_inspect)

    diff_parser = subparsers.add_parser("diff", help="Diff two GeoPackage datasets")
    diff_parser.add_argument("--base", required=True, help="Base GeoPackage path")
    diff_parser.add_argument("--candidate", required=True, help="Candidate GeoPackage path")
    diff_parser.add_argument("--layer", help="Layer name to compare")
    diff_parser.add_argument("--key-field", help="Stable feature key field")
    diff_parser.add_argument("--json", action="store_true", help="Emit JSON output")
    diff_parser.set_defaults(handler=_handle_diff)

    return parser


def _handle_inspect(args: argparse.Namespace) -> int:
    summary = inspect_dataset(args.dataset, args.layer)
    payload = asdict(summary)
    if args.json:
        print(json.dumps(payload, indent=2))
        return 0

    print(f"Dataset: {payload['dataset_path']}")
    print(f"Layer: {payload['layer']}")
    print(f"Available layers: {', '.join(payload['layers'])}")
    print(f"Feature count: {payload['feature_count']}")
    print(f"CRS: {payload['crs'] or 'unknown'}")
    print(f"Key field: {payload['key_field'] or 'not detected'}")
    print(f"Columns: {', '.join(payload['columns'])}")
    return 0


def _handle_diff(args: argparse.Namespace) -> int:
    result = diff_datasets(args.base, args.candidate, args.layer, args.key_field)
    payload = {
        "base_path": result.base_path,
        "candidate_path": result.candidate_path,
        "base_layer": result.base_layer,
        "candidate_layer": result.candidate_layer,
        "key_field": result.key_field,
        "counts": result.counts,
        "changes": [asdict(change) for change in result.changes],
    }
    if args.json:
        print(json.dumps(payload, indent=2))
        return 0

    print(f"Base: {result.base_path}")
    print(f"Candidate: {result.candidate_path}")
    print(f"Base layer: {result.base_layer}")
    print(f"Candidate layer: {result.candidate_layer}")
    print(f"Key field: {result.key_field}")
    for status, count in result.counts.items():
        print(f"{status}: {count}")
    if result.changes:
        print("Changed features:")
        for change in result.changes[:20]:
            suffix = f" ({', '.join(change.changed_fields)})" if change.changed_fields else ""
            print(f"- {change.key}: {change.status}{suffix}")
        remaining = len(result.changes) - 20
        if remaining > 0:
            print(f"... {remaining} more changes")
    return 0