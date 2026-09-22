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

test("keeps adjusted-FTE and cadence rules isolated in the calculator", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Adjusted FTE/);
  assert.match(page, /Enter percentage/);
  assert.match(page, /Worked date range/);
  assert.match(page, /Weeks not working/);
  assert.match(page, /\/ 364/);
  assert.match(page, /\(52-weeks\)\/52/);
  assert.match(page, /BASE_TARGET \* effort \/ 100 \* adjustedFte/);
  assert.match(page, /isProcedural\(task\) \? \.5/);
  assert.match(page, /Vacation\/CME weeks/);
  assert.match(page, /helperWeeks = Math\.max\(0, proposalWeeks - appliedVacationCmeWeeks\)/);
  assert.match(page, /Applied only to the weekly-cadence helper/);
  assert.match(page, /Ways to reduce/);
  assert.match(page, /COUNT · \{countUnit\(task\)\}/);
  assert.doesNotMatch(page, /Annual clinical capacity/);
});

test("supports completed-plan CSV export and round-trip import", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /Export plans/);
  assert.match(page, /Import plans/);
  assert.match(page, /Download CSV/);
  assert.match(page, /PLAN_CSV_HEADERS/);
  assert.match(page, /downloadPlansCsv/);
  assert.match(page, /const importCompletedPlans/);
  assert.match(page, /Use a completed-plan CSV exported from this tool/);
  assert.match(page, /plan_comment/);
  assert.match(page, /included/);
  assert.match(page, /weekend_only/);
  assert.match(page, /existing\?\.id/);
});

test("supports administrative provider and task workflows", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  const plansApi = await readFile(new URL("../app/api/plans/route.ts", import.meta.url), "utf8");

  assert.match(page, /normalizedPercent/);
  assert.match(page, /parsed <= 1 \? parsed\*100 : parsed/);
  assert.match(page, /provider-upload-template\.csv/);
  assert.match(page, /task-library-upload-template\.csv/);
  assert.match(page, /Reconcile provider rows before import/);
  assert.match(page, /Keep existing/);
  assert.match(page, /Use uploaded/);
  assert.match(page, /saveProviderAdmin/);
  assert.match(page, /deleteProviderAdmin/);
  assert.match(page, /saveTaskAdmin/);
  assert.match(page, /Temporary provider-specific overrides will be preserved/);
  assert.match(page, /Weekend only/);
  assert.match(page, /Save below-target plan/);
  assert.match(page, /Plan comment/);
  assert.match(page, /View change history/);
  assert.match(page, /ringGradient/);
  assert.match(plansApi, /below_target/);
  assert.doesNotMatch(plansApi, /The plan must meet the CU target/);
});
