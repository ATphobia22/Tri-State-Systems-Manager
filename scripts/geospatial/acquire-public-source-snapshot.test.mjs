import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedBody, fetchBoundedJson, SOURCES } from "./acquire-public-source-snapshot.mjs";

test("bounded body reader accepts a response within the byte limit", async () => {
  const body = await readBoundedBody(new Response(JSON.stringify({ ok: true })), 64);
  assert.deepEqual(JSON.parse(body.toString("utf8")), { ok: true });
});

test("bounded body reader rejects an oversized declared Content-Length", async () => {
  const response = new Response("123456", { headers: { "content-length": "6" } });
  await assert.rejects(readBoundedBody(response, 5), /exceeds safety limit/);
});

test("bounded body reader rejects an oversized streamed body without buffering it all", async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(4));
      controller.enqueue(new Uint8Array(4));
      controller.close();
    }
  }));
  await assert.rejects(readBoundedBody(response, 5), /exceeds safety limit/);
});

test("source fetch rejects non-allowlisted hosts before network access", async () => {
  let called = false;
  await assert.rejects(fetchBoundedJson("https://example.invalid/data.json", async () => {
    called = true;
    throw new Error("fetch should not run");
  }), /allowlist/);
  assert.equal(called, false);
});

test("source fetch disables redirects and validates JSON responses", async () => {
  let options;
  const result = await fetchBoundedJson(
    "https://api.waterdata.usgs.gov/ogcapi/v1/?f=json",
    async (_url, suppliedOptions) => {
      options = suppliedOptions;
      return new Response(JSON.stringify({ title: "USGS" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    },
    1024
  );
  assert.equal(options.redirect, "error");
  assert.deepEqual(result.document, { title: "USGS" });
});

test("source fetch rejects unexpected content type and malformed JSON", async () => {
  await assert.rejects(fetchBoundedJson(
    "https://api.waterdata.usgs.gov/ogcapi/v1/?f=json",
    async () => new Response("<html/>", { headers: { "content-type": "text/html" } })
  ), /expected JSON/);

  await assert.rejects(fetchBoundedJson(
    "https://api.waterdata.usgs.gov/ogcapi/v1/?f=json",
    async () => new Response("{broken", { headers: { "content-type": "application/json" } })
  ), /not valid JSON/);
});

test("governed IGIO metadata snapshots use exact official Current service endpoints", () => {
  const keys = ["igio-parcels-current", "igio-administrative-current",
                "igio-roads-current", "igio-addresses-current"];
  for (const key of keys) {
    const source = SOURCES[key];
    assert.ok(source, "missing source " + key);
    assert.match(source.url, /^https:\/\/gisdata\.in\.gov\/server\/rest\/services\/Hosted\//);
    assert.match(source.url, /_Current\/FeatureServer\?f=pjson$/);
    assert.ok(source.file.endsWith("-service-metadata.json"));
  }
});
test("bounded IGIO fetch rejects unexpected HTTP hosts and redirects", async () => {
  const source = SOURCES["igio-parcels-current"];
  let requested;
  await fetchBoundedJson(source.url, async (url,options)=>{
    requested={url:String(url),redirect:options.redirect};
    return new Response(JSON.stringify({layers:[]}), {headers:{"content-type":"application/json"}});
  });
  assert.equal(requested.url,source.url);
  assert.equal(requested.redirect,"error");
});
