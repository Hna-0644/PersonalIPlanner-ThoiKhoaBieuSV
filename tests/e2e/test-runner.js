#!/usr/bin/env node
/**
 * tests/e2e/test-runner.js
 * Standalone E2E Test Runner for PersonalIPlanner
 * Discovers and runs Tier 1 to Tier 4 test suites, collects metrics,
 * prints an ANSI scorecard table, and manages exit code 0/1.
 */

const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

// Ensure backend node_modules is resolvable
module.paths.push(path.resolve(__dirname, '../../backend/node_modules'));

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  magenta: '\x1b[35m'
};

async function main() {
  const args = process.argv.slice(2);
  const tierFilter = args.find(a => a.startsWith('--tier='))?.split('=')[1] ||
    (args.includes('-t') ? args[args.indexOf('-t') + 1] : null);

  const e2eDir = path.resolve(__dirname);
  const allFiles = fs.readdirSync(e2eDir)
    .filter(f => f.endsWith('.test.js'))
    .sort();

  let targetFiles = allFiles;
  if (tierFilter) {
    targetFiles = allFiles.filter(f => f.includes(`tier${tierFilter}`));
  } else if (args.length > 0 && !args[0].startsWith('-')) {
    targetFiles = allFiles.filter(f => f.includes(args[0]));
  }

  console.log(`\n${ANSI.bold}${ANSI.cyan}================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}  PersonalIPlanner E2E Test Runner (In-Memory HTTP Harness)${ANSI.reset}`);
  console.log(`${ANSI.cyan}================================================================${ANSI.reset}`);
  console.log(`Discovered ${targetFiles.length} test suite(s): ${targetFiles.join(', ')}\n`);

  const harness = require('./harness');
  const metrics = {
    total: 0,
    passed: 0,
    failed: 0,
    tiers: {
      'Tier 1': { name: 'Tier 1 (Feature Coverage)', passed: 0, failed: 0, total: 0 },
      'Tier 2': { name: 'Tier 2 (Boundary & Corner Cases)', passed: 0, failed: 0, total: 0 },
      'Tier 3': { name: 'Tier 3 (Cross-Feature Pairwise)', passed: 0, failed: 0, total: 0 },
      'Tier 4': { name: 'Tier 4 (Real-World Student Workloads)', passed: 0, failed: 0, total: 0 },
      'Other':  { name: 'General Integration', passed: 0, failed: 0, total: 0 }
    },
    failures: []
  };

  const suiteStartTime = performance.now();

  for (const file of targetFiles) {
    const fullPath = path.join(e2eDir, file);
    // Clear previously registered suites
    harness.registeredSuites.length = 0;

    // Load test suite file
    delete require.cache[require.resolve(fullPath)];
    require(fullPath);

    console.log(`${ANSI.bold}${ANSI.magenta}▶ Suite: ${file}${ANSI.reset}`);

    for (const suite of harness.registeredSuites) {
      console.log(`  ${ANSI.yellow}● ${suite.name}${ANSI.reset}`);

      for (const t of suite.tests) {
        // Determine Tier from filename, suite name, or test name
        let tierKey = 'Other';
        const combined = `${file} ${suite.name} ${t.name}`;
        if (/tier\s*1/i.test(combined)) tierKey = 'Tier 1';
        else if (/tier\s*2/i.test(combined)) tierKey = 'Tier 2';
        else if (/tier\s*3/i.test(combined)) tierKey = 'Tier 3';
        else if (/tier\s*4/i.test(combined)) tierKey = 'Tier 4';

        metrics.total++;
        metrics.tiers[tierKey].total++;

        const startTest = performance.now();
        try {
          for (const hook of suite.beforeEach) await hook();
          await t.fn();
          for (const hook of suite.afterEach) await hook();

          const duration = (performance.now() - startTest).toFixed(1);
          metrics.passed++;
          metrics.tiers[tierKey].passed++;
          console.log(`    ${ANSI.green}✔${ANSI.reset} ${t.name} ${ANSI.gray}(${duration}ms)${ANSI.reset}`);
        } catch (err) {
          const duration = (performance.now() - startTest).toFixed(1);
          metrics.failed++;
          metrics.tiers[tierKey].failed++;
          console.log(`    ${ANSI.red}✖ ${t.name} (${duration}ms)${ANSI.reset}`);
          console.log(`      ${ANSI.red}${err.message}${ANSI.reset}`);
          metrics.failures.push({
            suite: suite.name,
            test: t.name,
            error: err
          });
        }
      }
    }
    console.log();
  }

  const totalDuration = ((performance.now() - suiteStartTime) / 1000).toFixed(2);

  // ---------------------------------------------------------------------------
  // Summary Scorecard Report
  // ---------------------------------------------------------------------------
  console.log(`${ANSI.bold}${ANSI.cyan}================================================================${ANSI.reset}`);
  console.log(`${ANSI.bold}                   E2E TEST EXECUTION SCORECARD                  ${ANSI.reset}`);
  console.log(`${ANSI.cyan}================================================================${ANSI.reset}`);
  for (const [key, tier] of Object.entries(metrics.tiers)) {
    if (tier.total === 0) continue;
    const rate = tier.total > 0 ? ((tier.passed / tier.total) * 100).toFixed(0) : 0;
    const color = tier.failed === 0 ? ANSI.green : ANSI.red;
    console.log(`  ${tier.name.padEnd(38)} : ${color}${String(tier.passed).padStart(2)} / ${String(tier.total).padStart(2)} passed (${rate}%)${ANSI.reset}`);
  }
  console.log(`${ANSI.gray}----------------------------------------------------------------${ANSI.reset}`);
  const passRate = metrics.total > 0 ? ((metrics.passed / metrics.total) * 100).toFixed(1) : '0.0';
  console.log(`  ${ANSI.bold}Total Tests Executed${ANSI.reset}                   : ${metrics.total}`);
  console.log(`  ${ANSI.bold}Total Passed${ANSI.reset}                           : ${ANSI.green}${metrics.passed}${ANSI.reset}`);
  console.log(`  ${ANSI.bold}Total Failed${ANSI.reset}                           : ${metrics.failed > 0 ? ANSI.red : ANSI.green}${metrics.failed}${ANSI.reset}`);
  console.log(`  ${ANSI.bold}Pass Rate${ANSI.reset}                              : ${passRate}%`);
  console.log(`  ${ANSI.bold}Total Duration${ANSI.reset}                         : ${totalDuration}s`);

  if (metrics.failures.length > 0) {
    console.log(`\n${ANSI.bold}${ANSI.red}FAILURES DETAILS (${metrics.failures.length}):${ANSI.reset}`);
    metrics.failures.forEach((f, idx) => {
      console.log(`\n  ${idx + 1}) [${f.suite}] ${f.test}`);
      console.log(`     ${ANSI.red}${f.error.stack || f.error.message}${ANSI.reset}`);
    });
    console.log(`\n${ANSI.bold}${ANSI.red}RESULT: FAILED (Exit Code 1)${ANSI.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${ANSI.bold}${ANSI.green}RESULT: ALL TESTS PASSED (Exit Code 0)${ANSI.reset}`);
    console.log(`${ANSI.cyan}================================================================\n${ANSI.reset}`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
