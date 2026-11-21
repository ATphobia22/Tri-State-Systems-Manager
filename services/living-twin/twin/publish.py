import argparse
import json
from pathlib import Path

from .kafka import publish

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Publish a JSON state update as registry Avro")
    parser.add_argument("event", type=Path)
    args = parser.parse_args()
    publish(json.loads(args.event.read_bytes()))
