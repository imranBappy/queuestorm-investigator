#!/usr/bin/env node
/**
 * Regenerate sample_output.json from SAMPLE-01 in SUST_Preli_Sample_Cases.json.
 * Usage: pnpm start (in another terminal), then node scripts/generate-sample-output.js
 */
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5001;
const BASE = `http://localhost:${PORT}`;
const casesPath = path.join(__dirname, "..", "SUST_Preli_Sample_Cases.json");
const outPath = path.join(__dirname, "..", "sample_output.json");

async function main() {
  const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
  const sample = cases.cases.find((c) => c.id === "SAMPLE-01") || cases.cases[0];

  const health = await fetch(`${BASE}/health`);
  if (!health.ok) {
    console.error(`Server not reachable at ${BASE}. Run: pnpm start`);
    process.exit(1);
  }

  const res = await fetch(`${BASE}/analyze-ticket`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sample.input),
  });

  if (!res.ok) {
    console.error(`Analyze failed: HTTP ${res.status}`, await res.text());
    process.exit(1);
  }

  const body = await res.json();
  const output = {
    _meta: {
      title: "QueueStorm Investigator — Sample API Output",
      generated_at: new Date().toISOString(),
      source_case: "SUST_Preli_Sample_Cases.json",
      case_id: sample.id,
      case_label: sample.label,
      endpoint: "POST /analyze-ticket",
      note: "Actual output from running the local service against SAMPLE-01 input.",
    },
    input: sample.input,
    output: body,
    expected_output_reference: sample.expected_output,
  };

  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
