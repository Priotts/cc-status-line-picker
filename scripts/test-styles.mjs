#!/usr/bin/env node
/**
 * Smoke tests for every built style.
 *
 * The contract each style must honour:
 *   - never crash, whatever stdin contains (the docs note stderr is not shown,
 *     so a crash is an invisible failure);
 *   - always print something, so an empty status bar always means a real bug;
 *   - respect COLUMNS, so no line ever wraps;
 *   - emit no ANSI sequences when NO_COLOR is set.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gallery = JSON.parse(readFileSync(path.join(root, 'styles.json'), 'utf8'));

const sample = JSON.parse(readFileSync(path.join(root, 'examples', 'session.json'), 'utf8'));
delete sample.$comment;

const ANSI_RE = /\[[0-9;]*m/g;

/** Payloads a style must survive. Fields are null or missing before the first API response. */
const CASES = [
  { name: 'full sample', input: JSON.stringify(sample) },
  { name: 'empty object', input: '{}' },
  { name: 'empty stdin', input: '' },
  { name: 'not json', input: 'hello' },
  { name: 'json array', input: '[]' },
  {
    name: 'all nulls',
    input: JSON.stringify({
      cwd: null,
      model: null,
      workspace: null,
      cost: null,
      context_window: null,
      rate_limits: null,
      pr: null,
      worktree: null,
    }),
  },
  {
    name: 'nested nulls',
    input: JSON.stringify({
      model: { display_name: null },
      workspace: { current_dir: null, repo: null },
      context_window: { used_percentage: null, context_window_size: null },
      rate_limits: { five_hour: { used_percentage: null, resets_at: null }, seven_day: null },
      cost: { total_cost_usd: null, total_duration_ms: null },
      pr: { number: null },
    }),
  },
  {
    name: '1M context window at 97%',
    input: JSON.stringify({
      ...sample,
      context_window: {
        total_input_tokens: 970_000,
        total_output_tokens: 4000,
        context_window_size: 1_000_000,
        used_percentage: 97.4,
      },
      exceeds_200k_tokens: true,
    }),
  },
  {
    name: 'expired rate limit windows',
    input: JSON.stringify({
      ...sample,
      rate_limits: {
        five_hour: { used_percentage: 100, resets_at: 1 },
        seven_day: { used_percentage: 0, resets_at: 0 },
      },
    }),
  },
];

let failures = 0;

function check(styleId, caseName, condition, detail) {
  if (condition) return;
  failures += 1;
  console.error(`FAIL  ${styleId}  [${caseName}]  ${detail}`);
}

function runStyle(file, input, env) {
  return execFileSync(process.execPath, [file], {
    input,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, ...env },
    windowsHide: true,
  });
}

for (const style of gallery.styles) {
  const file = path.join(root, style.file);
  if (!existsSync(file)) {
    failures += 1;
    console.error(`FAIL  ${style.id}  missing build output ${style.file} — run \`npm run build\``);
    continue;
  }

  for (const testCase of CASES) {
    let output;
    try {
      output = runStyle(file, testCase.input, { COLUMNS: '120' });
    } catch (error) {
      failures += 1;
      console.error(`FAIL  ${style.id}  [${testCase.name}]  crashed: ${error.message}`);
      continue;
    }

    const lines = output.replace(/\n$/, '').split('\n');
    check(style.id, testCase.name, output.trim().length > 0, 'produced no output');
    check(
      style.id,
      testCase.name,
      !output.includes('statusline error:'),
      `hit the error fallback: ${output.trim()}`,
    );
    check(
      style.id,
      testCase.name,
      lines.length <= style.lines,
      `printed ${lines.length} lines, manifest declares ${style.lines}`,
    );
    for (const line of lines) {
      check(
        style.id,
        testCase.name,
        line.replace(ANSI_RE, '').length <= 120,
        `line exceeds COLUMNS=120: ${line.replace(ANSI_RE, '').length} chars`,
      );
    }
  }

  // Narrow terminal: output must be truncated, not wrapped.
  const narrow = runStyle(file, JSON.stringify(sample), { COLUMNS: '40' });
  for (const line of narrow.replace(/\n$/, '').split('\n')) {
    check(
      style.id,
      'COLUMNS=40',
      line.replace(ANSI_RE, '').length <= 40,
      `line exceeds COLUMNS=40: ${line.replace(ANSI_RE, '').length} chars`,
    );
  }

  // NO_COLOR must strip every escape sequence.
  const plain = runStyle(file, JSON.stringify(sample), { COLUMNS: '120', NO_COLOR: '1' });
  check(style.id, 'NO_COLOR', !ANSI_RE.test(plain), 'emitted ANSI escapes with NO_COLOR set');
  ANSI_RE.lastIndex = 0;
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log(`All checks passed: ${gallery.styles.length} styles x ${CASES.length} payloads`);
