# GeoPackage Collaboration and Merge Review

## Goals

The field observation dataset is currently stored as one or more GeoPackage files in the repository `data` folder. That keeps the working dataset close to the documentation and tooling, but it also creates a collaboration problem: GeoPackage files are binary SQLite containers, so parallel edits on different branches are difficult to review and unsafe to merge with normal Git conflict handling.

The collaboration workflow therefore has three main goals:

- keep one authoritative GeoPackage that represents the accepted project state
- allow contributors to work in parallel without relying on Git to merge binary GeoPackage content directly
- give the editor-in-chief a reviewable and reproducible way to inspect differences, resolve conflicts, and publish an approved merged dataset

## Approach

### Single-writer publication model

The repository should treat the canonical GeoPackage as a single-writer publication artifact. Contributors may work on branch-local copies, but only the editor-in-chief publishes changes back into the authoritative dataset.

This approach matches the current application architecture:

- the web UI writes GeoPackage files through a single-process service
- backups are created before the dataset is replaced
- the current implementation is designed for controlled local writes, not for concurrent multi-user database transactions

### Review changes as data changes, not as binary file conflicts

Git remains useful for versioning snapshots of the dataset, documentation, and code. It should not be treated as the primary content-level merge engine for GeoPackage edits.

Instead, the recommended workflow is:

1. a contributor edits a branch-local copy of the dataset
2. the contributor rebases or refreshes against the latest accepted base
3. differences between the base and candidate dataset are inspected explicitly
4. the editor-in-chief reviews conflicts and decides what is accepted
5. the approved merged result becomes the next canonical GeoPackage snapshot

This keeps review centered on features, attributes, and geometries rather than opaque binary deltas.

### Use a dedicated local CLI for merge review

For the editor-in-chief workflow, this repository now starts with a dedicated local CLI in `tools/gpkg_merge_cli/`.

The CLI is intended to evolve in phases:

- `inspect`: show dataset metadata, layers, feature counts, CRS, and the detected key field
- `diff`: compare a base and candidate GeoPackage and classify changes
- later phases: `merge`, `report`, and `publish`

The CLI is separate from the web UI on purpose. The web UI stays focused on editing, while the CLI is responsible for review, controlled comparison, and eventual publication.

## Use

### When contributors use this workflow

Use the collaboration workflow whenever more than one person may edit the same GeoPackage during the same period, especially when feature branches are expected to overlap in time.

Typical cases include:

- two editors updating observations in parallel
- one editor adjusting geometries while another updates attribute tags
- a feature branch that stays open long enough that the canonical dataset changes underneath it

### When the editor-in-chief uses the CLI

The editor-in-chief uses the CLI before accepting a branch-local dataset into the canonical GeoPackage.

Current Phase 1 usage:

```powershell
.\.venv312\Scripts\python.exe -m tools.gpkg_merge_cli inspect .\data\grassland_fieldObs_v2_export22may2026.gpkg
.\.venv312\Scripts\python.exe -m tools.gpkg_merge_cli diff --base .\data\grassland_fieldObs_v2_export22may2026.gpkg --candidate .\data\grassland_fieldObs_v16jul2023_export22may2026.gpkg
```

In practice, the editor-in-chief should use the CLI to answer questions such as:

- which layer and feature key are available in this dataset
- how many features were added or removed
- whether changes are mostly attribute edits, geometry edits, or both
- whether a candidate dataset is simple enough to accept directly or needs deeper review

### Current limits

The current CLI implementation is an initial review tool, not a finished merge engine.

At this stage:

- `inspect` and `diff` are implemented
- feature identity still needs to be hardened for production merge decisions
- full conflict resolution and controlled publish commands are planned but not complete yet

That means the current tool is already useful for structured review, but final acceptance decisions should still be made carefully until stable feature identity and merge rules are fully implemented.

## Why this matters for the documentation

This repository does not only publish field observation content. It also documents how the data is created, reviewed, and maintained. Making the collaboration and merge-review workflow explicit improves:

- reproducibility of dataset preparation
- transparency for contributors and reviewers
- auditability of accepted changes
- long-term maintainability as the observation dataset grows
