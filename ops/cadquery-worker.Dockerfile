# Optional isolated engineering worker. Keep it off the public network.
# Digest corresponds to the published cadquery/cadquery amd64 image observed in
# Docker Hub; pinning prevents mutable-tag drift.
FROM cadquery/cadquery:latest@sha256:521b162f789334692f4971c65c6ba9d70eeaef3e9f58b4c839cbebe04c5b5af3
WORKDIR /workspace
COPY integrations/engineering/cadquery-worker.py /workspace/cadquery-worker.py
ENV TSM_CADQUERY_ALLOW_EXPRESSION=false
ENTRYPOINT ["python", "/workspace/cadquery-worker.py"]
