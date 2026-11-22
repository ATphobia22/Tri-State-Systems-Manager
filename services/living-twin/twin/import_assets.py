"""Reviewed asset snapshot -> canonical matrix-I revision.

Input is a single JSON object with asset_id, asset_type, name, version,
source, valid_from, optional properties, relationships and GeoJSON geometry.
"""
import argparse
import json
from pathlib import Path

from .asset_shells import export_aas, make_event
from .store import apply


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--aas-preview", action="store_true",
                        help="Only output AAS-shaped JSON; do not commit an event")
    options = parser.parse_args()
    if options.manifest.stat().st_size > 524288:
        parser.error("Asset manifest exceeds 512 KiB")
    document = json.loads(options.manifest.read_text(encoding="utf-8"))
    event = make_event(**document)
    if options.aas_preview:
        print(json.dumps(export_aas(event), indent=2, sort_keys=True))
        return
    seq, inserted = apply(event)
    print(json.dumps({"event_id": event["event_id"], "sequence": seq,
                      "inserted": inserted, "asset_id": event["state"]["asset_id"]}))


if __name__ == "__main__":
    main()
