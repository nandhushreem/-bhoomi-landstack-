export function sampleParcels() {
  const names = [
    "Ananya Rao",
    "Karthik Kumar",
    "Meera Devi",
    "Ravi Prakash",
    "Lakshmi Nair",
    "Arjun Reddy",
    "Priya Menon",
    "Suresh Babu",
    "Divya Sharma",
    "Vijay Anand",
    "Kavya Iyer",
    "Mohan Das",
  ];
  const original = Array.from({ length: 60 }, (_, i) => {
    const rural = i >= 30,
      j = i % 30,
      row = Math.floor(j / 6),
      col = j % 6;
    const x = (rural ? 77.718 : 77.593) + col * 0.0014 + (row % 2) * 0.00012,
      y = (rural ? 13.035 : 12.971) + row * 0.0011;
    const w = 0.00112,
      h = 0.00082;
    return {
      id: `${rural ? "VIL" : "URB"}-${String(j + 1).padStart(3, "0")}`,
      survey_no: `${rural ? "V" : "W"}-${104 + j}/A`,
      demo_identifier: `DEMO-${rural ? "KA-V" : "KA-U"}-${10001 + j}`,
      owner: names[i % names.length],
      area: 680 + ((i * 137) % 2400),
      zone: rural
        ? i % 4 === 0
          ? "Conservation"
          : "Agricultural"
        : [
            "Residential",
            "Commercial",
            "Residential",
            "Mixed use",
            "Public use",
          ][i % 5],
      locality: rural ? "Sampige Village" : "Ashok Nagar Ward",
      context: rural ? "Rural" : "Urban",
      tax_due: i % 5 === 0 ? 3200 + i * 37 : 0,
      disputed: i % 13 === 0,
      encumbrance:
        i % 9 === 0 ? "Sample mortgage recorded" : "No sample encumbrance",
      permission: i % 7 === 0 ? "Approval pending" : "No active application",
      registered_at: "2025-11-12",
      version: 1,
      source_updated: "2026-10-30",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [x, y],
            [x + w, y + 0.00004],
            [x + w - 0.00006, y + h],
            [x + 0.00003, y + h - 0.00003],
            [x, y],
          ],
        ],
      },
    };
  });
  const states = [
    {
      code: "KA",
      name: "Karnataka",
      dx: 0,
      dy: 0,
      urban: "Ashok Nagar Ward",
      rural: "Sampige Village",
    },
    {
      code: "TN",
      name: "Tamil Nadu",
      dx: 2.677,
      dy: 0.11,
      urban: "Mylapore Ward",
      rural: "Marudham Village",
    },
    {
      code: "AP",
      name: "Andhra Pradesh",
      dx: 2.52,
      dy: 3.54,
      urban: "Vijayawada Ward",
      rural: "Amaravathi Village",
    },
  ];
  return states.flatMap((s) =>
    original.map((p, i) => ({
      ...p,
      id: s.code === "KA" ? p.id : `${s.code}-${p.id}`,
      demo_identifier: `DEMO-${s.code}-${p.id}`,
      state: s.code,
      state_name: s.name,
      locality: p.context === "Urban" ? s.urban : s.rural,
      valuation_rate: 1800 + i * 70,
      source: "Bhoomi synthetic pilot",
      geometry: {
        ...p.geometry,
        coordinates: p.geometry.coordinates.map((r) =>
          r.map(([x, y]) => [x + s.dx, y + s.dy]),
        ),
      },
    })),
  );
}
export function recordChecks(p) {
  const checks = [];
  if (p.disputed)
    checks.push({
      severity: "high",
      code: "DISPUTE",
      title: "Dispute requires review",
      detail:
        "A synthetic dispute flag is active. Changes require the officer review queue.",
    });
  if (Number(p.tax_due) > 0)
    checks.push({
      severity: "medium",
      code: "TAX_DUE",
      title: "Outstanding sample tax",
      detail: `Fiscal dataset reports INR ${p.tax_due} outstanding. This is a review indicator, not a legal restriction.`,
    });
  if (p.encumbrance?.includes("mortgage"))
    checks.push({
      severity: "medium",
      code: "MORTGAGE",
      title: "Mortgage record present",
      detail:
        "Review the linked synthetic encumbrance record before a transaction.",
    });
  if (p.zone === "Conservation")
    checks.push({
      severity: "high",
      code: "CONSERVATION",
      title: "Conservation land-use designation",
      detail:
        "The sample master plan marks this parcel as conservation land. A planning review is required for development.",
    });
  return checks;
}
export function sourceRecords(p, i = 0) {
  return [
    {
      domain: "rights",
      department: "revenue",
      values: { owner: p.owner, area: p.area, survey_no: p.survey_no },
    },
    {
      domain: "registration",
      department: "registration",
      values: {
        owner: p.owner,
        area: i % 17 === 0 ? p.area + 45 : p.area,
        deed_ref: `SAMPLE-DEED-${p.id}`,
        registered_at: p.registered_at,
        encumbrance: p.encumbrance,
      },
    },
    {
      domain: "planning",
      department: "planning",
      values: {
        zone: p.zone,
        permission: p.permission,
        master_plan: "Synthetic master plan 2035",
      },
    },
    {
      domain: "fiscal",
      department: "fiscal",
      values: { tax_due: p.tax_due, valuation_rate: p.valuation_rate || 2000 },
    },
  ].map((r) => ({
    id: `${p.id}:${r.domain}`,
    parcel_id: p.id,
    ...r,
    source: "Bhoomi synthetic pilot",
    updated_at: p.source_updated,
  }));
}
export function spatialLayers() {
  return ["KA", "TN", "AP"].flatMap((state) =>
    ["Urban", "Rural"].flatMap((context) => {
      const p = sampleParcels().find(
          (p) => p.state === state && p.context === context,
        ),
        [x, y] = p.geometry.coordinates[0][0];
      return [
        {
          type: "Feature",
          id: `${state}-${context}-restriction`,
          properties: {
            state,
            context,
            kind: "restriction",
            name: "Sample environmental review zone",
            source: "Synthetic environmental department",
            updated_at: "2026-10-30",
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [x + 0.002, y - 0.0003],
                [x + 0.005, y - 0.0003],
                [x + 0.005, y + 0.005],
                [x + 0.002, y + 0.005],
                [x + 0.002, y - 0.0003],
              ],
            ],
          },
        },
        {
          type: "Feature",
          id: `${state}-${context}-water`,
          properties: {
            state,
            context,
            kind: "utility",
            name: "Sample water supply corridor",
            source: "Synthetic utility department",
            updated_at: "2026-10-30",
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [x - 0.001, y + 0.0025],
              [x + 0.01, y + 0.0025],
            ],
          },
        },
      ];
    }),
  );
}
