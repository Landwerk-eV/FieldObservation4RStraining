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
- `FIELDOBS_CORS_ORIGINS`: comma-separated list of allowed browser origins
- `FIELDOBS_API_KEY`: optional access token required for `/api/*` except `/api/health`
- `FIELDOBS_MAX_FEATURES`: maximum features allowed in one save payload
- `FIELDOBS_BACKUP_RETENTION_DAYS`: remove backups older than this many days; `0` disables time-based cleanup
- `FIELDOBS_BACKUP_RETENTION_COUNT`: keep only this many backups per dataset; `0` disables count-based cleanup

### IONOS deployment

For a public deployment, use an IONOS VPS or cloud server, not shared hosting. The app needs a writable persistent disk and a single-process Python geospatial runtime.

Recommended layout:

1. Build and run the service with Docker from the repository root.
2. Mount persistent volumes for `FIELDOBS_DATA_DIR` and `FIELDOBS_BACKUP_DIR`.
3. Put nginx or the IONOS reverse proxy in front of the container and terminate HTTPS there.
4. Set `FIELDOBS_API_KEY` and restrict `FIELDOBS_CORS_ORIGINS` to the public site.
5. Keep the app to one worker/process because GeoPackage writes are guarded by a process-local lock.

Deployment notes and a sample nginx config are stored in [dev/IONOS_DEPLOYMENT.md](dev/IONOS_DEPLOYMENT.md) and [dev/nginx/fieldobs.conf](dev/nginx/fieldobs.conf).

The repository root also includes [dev/.env.example](dev/.env.example) for the Docker Compose variables.
