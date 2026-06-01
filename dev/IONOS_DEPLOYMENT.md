# IONOS deployment checklist

## Target shape

- Use an IONOS VPS or cloud server.
- Run a single webUI instance.
- Store GeoPackage files on a persistent mounted volume.
- Put nginx or the IONOS reverse proxy in front of the app.
- Terminate HTTPS at the proxy.

## Runtime requirements

- Python 3.12 or the Python version pinned in the Docker image.
- Native geospatial libraries: GDAL, GEOS, and PROJ.
- One writable data directory and one backup directory.
- `FIELDOBS_API_KEY` set in production.

## Bring-up order

1. Copy the `.gpkg` files into the persistent `FIELDOBS_DATA_DIR` volume.
2. Set `FIELDOBS_BACKUP_DIR` to a separate persistent path.
3. Export `FIELDOBS_API_KEY` and the public origin in `FIELDOBS_CORS_ORIGINS`.
4. Start the container or service with one worker only.
5. Configure nginx to proxy to `127.0.0.1:8000`.
6. Open the site through HTTPS and verify dataset load/save.

## Operational checks

- Confirm backups are being written after each save.
- Confirm old backups are cleaned up according to retention settings.
- Confirm unauthorized requests return `401`.
- Confirm only the intended origin can call the browser API.

## Rollback

- Stop the service.
- Restore a known-good `.gpkg` from the backup directory.
- Start the service again and verify the dataset opens cleanly.