#!/usr/bin/env node
/**
 * End-to-end test of the activation path, against a sandboxed home directory.
 *
 * The styles are covered by test-styles.mjs; this covers everything around them:
 * writing settings.json, backups, restore, remove, and the guard that refuses to
 * touch a settings file it cannot parse.
 *
 * The step that matters most is EXECUTING the generated `statusLine.command`
 * through the platform's own shell. That command string is assembled on one OS
 * and interpreted by another's shell, which is where quoting and path
 * separators actually break — and it cannot be checked by reasoning about it.
 *
 * `os.homedir()` reads $HOME on Unix and %USERPROFILE% on Windows, so
 * overriding both redirects the installer into a temp directory and the real
 * settings.json is never touched.
 */
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const installer = path.join(root, 'scripts', 'install-style.mjs');

const sandbox = mkdtempSync(path.join(os.tmpdir(), 'slp-install-test-'));
const fakeHome = path.join(sandbox, 'home');
const settingsFile = path.join(fakeHome, '.claude', 'settings.json');
mkdirSync(path.join(fakeHome, '.claude'), { recursive: true });

const env = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome };

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  ok   ${name}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}

function install(...args) {
  return execFileSync(process.execPath, [installer, ...args], {
    encoding: 'utf8',
    env,
    timeout: 30_000,
    // Capture stderr instead of letting it through: one case deliberately makes
    // the installer fail, and its error message would read as a test failure.
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function settings() {
  return JSON.parse(readFileSync(settingsFile, 'utf8'));
}

console.log(`sandbox home: ${fakeHome}\n`);

try {
  // --- activation preserves unrelated keys ------------------------------------
  writeFileSync(settingsFile, JSON.stringify({ model: 'opus', theme: 'dark' }, null, 2));
  install('fancy/multiline');

  const afterInstall = settings();
  check('unrelated settings keys survive', afterInstall.model === 'opus' && afterInstall.theme === 'dark');
  check('statusLine.type is "command"', afterInstall.statusLine?.type === 'command');
  check('command has no backslashes', !afterInstall.statusLine?.command.includes('\\'),
    afterInstall.statusLine?.command);

  const activeScript = path.join(fakeHome, '.claude', 'statusline-picker', 'active.mjs');
  check('active.mjs was copied', existsSync(activeScript));
  check('config.json was seeded', existsSync(path.join(fakeHome, '.claude', 'statusline-picker', 'config.json')));

  // --- the generated command actually runs in this platform's shell -----------
  const payload = JSON.stringify({
    model: { display_name: 'Opus' },
    workspace: { current_dir: root },
    context_window: { used_percentage: 38, context_window_size: 200_000 },
    cost: { total_cost_usd: 0.42 },
    rate_limits: { five_hour: { used_percentage: 24, resets_at: Math.floor(Date.now() / 1000) + 3600 } },
  });

  let shellOutput = '';
  try {
    shellOutput = execSync(afterInstall.statusLine.command, {
      input: payload,
      encoding: 'utf8',
      env,
      timeout: 30_000,
      windowsHide: true,
    });
  } catch (error) {
    shellOutput = `<threw: ${error.message}>`;
  }
  check('generated command runs through the platform shell', shellOutput.includes('38%'),
    JSON.stringify(shellOutput));

  // --- config.json is not clobbered on reinstall ------------------------------
  const configFile = path.join(fakeHome, '.claude', 'statusline-picker', 'config.json');
  writeFileSync(configFile, JSON.stringify({ separator: ' | ', barWidth: 4 }, null, 2));
  install('usage/cost');
  check('user config survives a reinstall', JSON.parse(readFileSync(configFile, 'utf8')).separator === ' | ');

  // --- status reports the active style ----------------------------------------
  check('--status reports the active style', install('--status').includes('usage/cost'));

  // --- restore brings back the previous statusLine -----------------------------
  install('--restore');
  check('--restore restores the previous statusLine',
    JSON.stringify(settings().statusLine) === JSON.stringify(afterInstall.statusLine),
    JSON.stringify(settings().statusLine));

  // --- remove strips statusLine but keeps everything else ----------------------
  install('--remove');
  const afterRemove = settings();
  check('--remove drops statusLine', afterRemove.statusLine === undefined);
  check('--remove keeps other keys', afterRemove.model === 'opus');

  // --- a settings.json that does not parse is never overwritten ----------------
  const corrupt = '{ this is not json';
  writeFileSync(settingsFile, corrupt);
  let refused = false;
  try {
    install('git/full');
  } catch {
    refused = true;
  }
  check('refuses to write over invalid JSON', refused);
  check('invalid settings.json left untouched', readFileSync(settingsFile, 'utf8') === corrupt);
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nInstall path OK');
