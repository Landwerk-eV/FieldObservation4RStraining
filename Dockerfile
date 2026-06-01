FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        gdal-bin \
        libgdal-dev \
        libgeos-dev \
        proj-bin \
        proj-data \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-webui.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements-webui.txt

COPY app ./app

RUN mkdir -p /data /backups

ENV FIELDOBS_DATA_DIR=/data \
    FIELDOBS_BACKUP_DIR=/backups \
    FIELDOBS_CORS_ORIGINS=http://127.0.0.1:8000,http://localhost:8000

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]