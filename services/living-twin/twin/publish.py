import argparse
import json
from pathlib import Path

from .kafka import publish
from .observability import setup

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publish a JSON state update as registry Avro")
    parser.add_argument("event", type=Path)
    args = parser.parse_args()
    with setup("living-twin-publisher").start_as_current_span("twin.publish"):
        publish(json.loads(args.event.read_bytes()))
