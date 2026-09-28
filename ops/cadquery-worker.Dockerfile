# Optional isolated engineering worker. Keep it off the public network.
FROM cadquery/cadquery:latest
WORKDIR /workspace
COPY integrations/engineering/cadquery-worker.py /workspace/cadquery-worker.py
ENV TSM_CADQUERY_ALLOW_EXPRESSION=false
ENTRYPOINT ["python", "/workspace/cadquery-worker.py"]
