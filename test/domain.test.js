import test from "node:test";
import assert from "node:assert/strict";
import {
  canWork,
  validateImport,
  profiles,
  services,
  validGeometry,
} from "../server/domain.js";
const geometry = {
  type: "Polygon",
  coordinates: [
    [
      [80, 13],
      [80.001, 13],
      [80.001, 13.001],
      [80, 13.001],
      [80, 13],
    ],
  ],
};
test("malformed rows and coordinate rings produce validation errors", () => {
  const payload = fixture("KA", 100);
  payload.records = [null];
  assert.ok(validateImport(payload).errors.length);
  assert.equal(validGeometry({ type: "Polygon", coordinates: [null] }), false);
  assert.ok(validateImport({ state: "constructor" }).errors.length);
});
function fixture(state, extent) {
  const f = profiles[state].fields;
  return {
    state,
    source: "Synthetic unit test",
    records: [
      {
        [f.id]: "DEMO-UNIT-001",
        [f.owner]: "Sample Citizen",
        [f.area]: extent,
        [f.survey_no]: "SAMPLE-01",
        context: "Urban",
        locality: "Test ward",
        zone: "Residential",
        geometry,
      },
    ],
  };
}
test("state adapters normalize hectares and acres without changing source payload", () => {
  const payload = fixture("TN", 0.12),
    before = JSON.stringify(payload);
  assert.equal(validateImport(payload).records[0].area, 1200);
  assert.equal(JSON.stringify(payload), before);
  assert.equal(validateImport(fixture("AP", 1)).records[0].area, 4046.86);
});
test("invalid identifiers, duplicate rows and unclosed rings block an import", () => {
  const p = fixture("KA", 100);
  p.records.push({ ...p.records[0] });
  assert.ok(validateImport(p).errors.some((e) => e.includes("duplicate")));
  p.records = [
    {
      ...p.records[0],
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [80, 13],
            [80.001, 13],
            [80, 13.001],
            [80.01, 13],
          ],
        ],
      },
    },
  ];
  assert.ok(validateImport(p).errors.length);
});
test("department and state checks prevent cross-department or cross-jurisdiction decisions", () => {
  const u = { role: "officer", department: "revenue", jurisdiction: "KA" };
  assert.equal(canWork(u, "registration", "KA"), false);
  assert.equal(canWork(u, "revenue", "TN"), false);
  assert.equal(canWork(u, "revenue", "KA"), true);
  assert.equal(canWork({ role: "citizen" }, "revenue", "KA"), false);
  assert.equal(
    canWork({ ...u, department: "administrator" }, "fiscal", "TN"),
    true,
  );
});
test("registration workflow separates registration, mutation and fiscal acknowledgement", () => {
  assert.deepEqual(services["Registration & mutation"].departments, [
    "registration",
    "revenue",
    "fiscal",
  ]);
  assert.deepEqual(services["Building permission"].departments, [
    "planning",
    "fiscal",
  ]);
});
