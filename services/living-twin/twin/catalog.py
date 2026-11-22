"""Publish explicitly declared, spatially indexed assets to pgSTAC."""
from psycopg.types.json import Jsonb

from .settings import COLLECTION

COLLECTION_BODY = {
    "type": "Collection", "stac_version": "1.0.0", "id": COLLECTION,
    "description": "Versioned assets linked to TSM living twin evidence",
    "license": "various", "links": [],
    "extent": {"spatial": {"bbox": [[-180, -90, 180, 90]]},
               "temporal": {"interval": [[None, None]]}},
}


def prepare_catalog(conn):
    conn.execute("SELECT pgstac.upsert_collection(%s::jsonb)", (Jsonb(COLLECTION_BODY),))


def item_for(row):
    event = row["event"]
    asset = event["asset"]
    return {
        "type": "Feature", "stac_version": "1.0.0", "id": event["event_id"],
        "collection": COLLECTION, "links": [{"rel": "collection", "href": f"./{COLLECTION}"}],
        "geometry": row["geometry"], "bbox": row["bbox"],
        "properties": {
            "datetime": event["valid_from"], "tsm:matrix": event["matrix"],
            "tsm:entity_id": event["entity_id"], "tsm:timeline": event["timeline"],
            "tsm:branch": event["branch"], "tsm:source_sha256": event["source"]["sha256"],
            "tsm:source": event["source"]["uri"],
        },
        "assets": {"data": {"href": asset["href"], "type": asset["media_type"],
                            "roles": ["data"], "tsm:sha256": asset["sha256"]}},
    }


def deliver(conn, row):
    conn.execute("SELECT pgstac.upsert_item(%s::jsonb)", (Jsonb(item_for(row)),))
