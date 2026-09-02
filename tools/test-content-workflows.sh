#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

for script in \
  tools/run-collect.sh \
  tools/scan-parallel.sh \
  tools/desk-run.sh \
  tools/downstream-split.sh; do
  bash -n "$script"
done

node tools/validate-workflows.js
node tools/test-workflow-contracts.js
node tools/test-plan-dry-runs.js
node tools/test-socle-reuse.js
node tools/test-extract-universe.js
node tools/test-mcp-client.js
node tools/test-market-calendar.js
node tools/check-freshness.test.js
node tools/test-evidence-gates.js
node tools/test-trade-idea-gates.js
node tools/test-analysis-evidence.js
node tools/test-content-claims.js
node tools/test-selection-gates.js
node tools/test-semantic-evidence.js
node tools/test-dtx-content-gates.js
node tools/test-dtx-refresh.js
node tools/test-intraday-retro-input.js
node tools/test-dtx-book-equity-ingest.js
node tools/test-scanner-quality-gates.js
node tools/lessons-engine.test.js
node tools/lessons-retrieve.js --self-test
node tools/lib/score-contract.js --self-test
node tools/lib/valuation-multi.js --self-test

printf 'content workflow suite: PASS\n'
