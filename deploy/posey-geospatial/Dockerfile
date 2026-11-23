FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY deploy/posey-geospatial/requirements.txt /app/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/requirements.txt
COPY backend/__init__.py /app/backend/__init__.py
COPY backend/geospatial /app/backend/geospatial
COPY scripts/geospatial/posey_source_ingest.py /app/scripts/geospatial/posey_source_ingest.py
COPY data/posey-county/boundaries/posey-county.geojson /app/data/posey-county/boundaries/posey-county.geojson
RUN useradd --create-home --uid 10001 tsm && mkdir -p /var/lib/tsm/geospatial && chown -R tsm:tsm /var/lib/tsm
USER tsm
EXPOSE 8791
CMD ["uvicorn", "backend.geospatial.posey_stack:app", "--host", "0.0.0.0", "--port", "8791"]
