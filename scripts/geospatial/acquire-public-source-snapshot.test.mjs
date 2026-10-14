import test from "node:test";
import assert from "node:assert/strict";
import { readBoundedBody, fetchBoundedJson } from "./acquire-public-source-snapshot.mjs";

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
