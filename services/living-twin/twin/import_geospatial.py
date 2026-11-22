"""Commit a reviewed geospatial-link manifest, or preview it without writing."""
import argparse
import json
from pathlib import Path

from .geospatial_links import make_link_event
from .store import apply


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    if args.manifest.is_symlink() or args.manifest.stat().st_size > 730_000:
        parser.error("Refusing symlink or oversized spatial manifest")
    body = json.loads(args.manifest.read_text(encoding="utf-8"))
    event = make_link_event(**body)
    if args.preview:
        print(json.dumps(event, indent=2, sort_keys=True, allow_nan=False))
        return
    seq, inserted = apply(event)
    print(json.dumps({"event_id": event["event_id"], "sequence": seq,
                      "inserted": inserted, "layer_kind": event["state"]["geo_layer_kind"],
                      "coordinate_status": event["state"]["coordinate_status"]}))


if __name__ == "__main__":
    main()
