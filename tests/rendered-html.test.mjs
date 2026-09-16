import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the clinical unit planner", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Clinical Unit Planner<\/title>/i);
  assert.match(html, /Clinical Unit Planner/);
  assert.match(html, /Provider planning status/);
  assert.match(html, /460/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});

test("keeps adjusted-FTE and day-capacity rules in the calculator", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Adjusted FTE/);
  assert.match(page, /BASE_TARGET \* effort \/ 100 \* adjustedFte/);
  assert.match(page, /260 \* selected\.effort \/ 100 \* appliedAdjustedFte/);
  assert.match(page, /isProcedural\(task\) \? \.5/);
  assert.match(page, /Outpatient & precepting/);
  assert.match(page, /Ways to reduce/);
  assert.match(page, /COUNT · \{countUnit\(task\)\}/);
  assert.doesNotMatch(page, /Vacation & CME/);
});
