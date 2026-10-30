import test from "node:test";
import assert from "node:assert/strict";
import { sampleParcels, recordChecks } from "../server/seed.js";
test("pilot dataset has unique closed parcel boundaries across three states and both contexts", () => {
  const p = sampleParcels();
  assert.equal(p.length, 180);
  assert.equal(new Set(p.map((v) => v.id)).size, 180);
  assert.deepEqual(
    new Set(p.map((v) => v.context)),
    new Set(["Urban", "Rural"]),
  );
  assert.deepEqual(new Set(p.map((v) => v.state)), new Set(["KA", "TN", "AP"]));
  for (const v of p) {
    const ring = v.geometry.coordinates[0];
    assert.deepEqual(ring[0], ring.at(-1));
    assert.ok(v.demo_identifier.startsWith("DEMO-"));
  }
});
test("risk indicators explain dispute, fiscal and mortgage records without altering them", () => {
  const p = sampleParcels()[0],
    before = JSON.stringify(p);
  assert.deepEqual(
    recordChecks(p).map((v) => v.code),
    ["DISPUTE", "TAX_DUE", "MORTGAGE"],
  );
  assert.equal(JSON.stringify(p), before);
  assert.equal(recordChecks(sampleParcels()[1]).length, 0);
});
