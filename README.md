# FieldObservation4RStraining

Preparation of field observation imagery and analysis into databases for training remote-sensing classification workflows, with an initial focus on grassland characterisation.
Thorsten Schad, Landwerk eV, 2026

## License and Citation

This repository and its data are licensed under **CC0 1.0 Universal**.

While the data is CC0, we kindly request that users cite our repository and organisation Landwerk-eV.

## Documentation

The repository includes a MkDocs-based documentation site built from the source presentation in [docs/Grassland Types&Management FieldObservation - v06.may2026.pptx](docs/Grassland%20Types%26Management%20FieldObservation%20-%20v06.may2026.pptx).

### Local preview

Install the documentation dependencies and run:

```powershell
pip install -r requirements.txt
mkdocs serve
```

### Publishing

GitHub Actions publishes the site to GitHub Pages automatically on every commit to `main`.

## Web UI (Initial Implementation)

An initial local-first web UI is available for GeoPackage polygon and attribute editing.

### Python version

Use Python `3.10` to `3.12` for the Web UI dependencies.
Geospatial packages in `requirements-webui.txt` are not reliably available for newer Python versions yet.

### Install app dependencies

```powershell
pip install -r requirements-webui.txt
```

### Run the app

```powershell
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000` in your browser.

### Environment variables

- `FIELDOBS_DATA_DIR`: data directory containing `.gpkg` files (default: `./data`)
- `FIELDOBS_BACKUP_DIR`: backup output directory (default: `./data/backups`)
- `FIELDOBS_DEFAULT_LAYER`: optional preferred layer name
