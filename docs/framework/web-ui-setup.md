# Web UI Setup and Troubleshooting

This page documents the local setup for the GeoPackage editing Web UI and common startup issues on Windows.

## Supported Python version

Use Python **3.10 to 3.12** for Web UI dependencies.

If you use Python 3.13+ (for example 3.14), geospatial packages such as Fiona may not provide compatible wheels yet and pip may fail with GDAL build errors.

## Recommended setup (Windows)

From the repository root:

```powershell
py install 3.12
py -3.12 -m venv .venv312
.\.venv312\Scripts\python.exe -m pip install -r requirements-webui.txt
.\start_webui.bat
```

The launcher will prefer `.venv312` when it exists.

## Expected startup URL

Open:

- `http://127.0.0.1:8000`

## Known error: Fiona GDAL API version must be specified

Example error:

```text
CRITICAL:root:A GDAL API version must be specified.
Provide a path to gdal-config using a GDAL_CONFIG environment variable
or use a GDAL_VERSION environment variable.
```

Meaning:

- pip is trying to build Fiona from source because no compatible wheel was found for your Python version.

Fix:

1. Install Python 3.12.
2. Create a fresh environment.
3. Reinstall with `requirements-webui.txt`.

## Known issue: existing `.venv` cannot be deleted

On Windows, active processes can lock files in a virtual environment.

If removal of `.venv` fails with access denied or file-in-use errors:

1. Stop running `mkdocs serve`, `uvicorn`, and active Python terminals using that venv.
2. Use a fresh environment (`.venv312`) and continue.
3. Remove old `.venv` later after all locks are released.
