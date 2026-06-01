# Editor-in-Chief GeoPackage Merge CLI

Recommended approach: keep the canonical GeoPackage as a single-writer artifact and implement a separate local Python CLI for the editor-in-chief that performs three-way comparison and controlled publication. Phase 1 starts with `inspect` and `diff`, then adds `merge` and `publish` once stable feature identity and review artifacts are in place.

## Steps

1. Create a dedicated package for the CLI at `tools/gpkg_merge_cli/` and keep it separate from the web app.
2. Reuse core validation and GeoPackage write-safety patterns from `app/validation.py` and `app/gpkg_service.py` rather than duplicating geospatial behavior.
3. Define the Phase 1 command surface around explicit files, not Git internals:
   - `inspect`
   - `diff`
   - `merge`
   - `report`
   - `publish`
4. Reuse path conventions from `app/config.py` where useful, but keep CLI arguments explicit so the editor-in-chief can point at arbitrary input and output files.
5. Standardize feature identity before merge logic lands. If `FID` or `OBJECTID` is not stable enough, add a persistent UUID field before relying on the tool for production merges.
6. Emit review artifacts optimized for the editor-in-chief, including machine-readable JSON, Markdown summaries, and GeoJSON conflict layers for QGIS.
7. Keep publication as a separate command that refuses unresolved conflicts, validates merged output, creates a timestamped backup, and only then writes the approved `.gpkg`.

## Recommended module layout

- `cli.py` - argument parsing and command routing
- `io.py` - open GeoPackage layers, normalize schemas, resolve stable feature keys
- `diffing.py` - feature alignment and change classification
- `merge_logic.py` - three-way merge rules and conflict detection
- `reports.py` - Markdown or HTML summaries and GeoJSON review outputs
- `publish.py` - backup creation, merged file write, provenance logging
- `models.py` - typed result structures for feature changes, conflicts, and publish metadata

## Phase 1 commands

### `inspect`

Show dataset metadata, layers, feature counts, CRS, columns, and the detected stable key candidate.

### `diff --base BASE.gpkg --candidate CANDIDATE.gpkg`

Compare two datasets and classify changes as:

- unchanged
- added
- deleted
- attribute_only
- geometry_only
- attribute_and_geometry

Outputs should support both terminal summaries and JSON export.

## Verification

1. Build a small synthetic test matrix using three GeoPackages derived from one base.
2. Confirm `inspect` reports consistent metadata for the existing repo datasets.
3. Confirm `diff` correctly reports additions, deletions, attribute-only edits, and geometry-only edits.
4. Open generated review GeoJSON outputs in QGIS once geometry review layers are added.

## Decisions

- Phase 1 implementation: plain Python CLI with the existing geospatial dependency stack.
- Entry point shape: one executable with subcommands rather than multiple scripts.
- Conflict policy: conservative by default; unresolved conflicts block later publish.
- Phase 1 scope: no interactive UI, no automatic Git branch discovery, and no live multi-user locking.