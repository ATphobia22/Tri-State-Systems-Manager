FROM python:3.12.11-slim-bookworm
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY alembic.ini .
COPY migrations migrations
COPY schemas schemas
COPY twin twin
COPY tests tests
COPY --from=twin_api / /app/state_api
USER 10001
