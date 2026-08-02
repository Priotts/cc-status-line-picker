#!/usr/bin/env node
/**
 * Activates a gallery style by writing `statusLine` into a settings.json.
 *
 *   node scripts/install-style.mjs git/full
 *   node scripts/install-style.mjs usage/cost --scope project
 *   node scripts/install-style.mjs --status
 *   node scripts/install-style.mjs --restore
 *   node scripts/install-style.mjs --remove
 *
 * Why the chosen style is COPIED instead of referenced in place:
 *   - `${CLAUDE_PLUGIN_ROOT}` is not expanded inside settings.json; it only
 *     resolves within plugin components (skills, hooks, MCP, LSP);
 *   - the plugin's installation directory changes on every update and the old
 *     one is eventually deleted.
 * So a path pointing into the plugin would break either immediately or on the
 * next update. Instead the bundled, self-contained style is copied to
 * ~/.claude/statusline-picker/active.mjs, which is stable.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INSTALL_DIR = path.join(os.homedir(), '.claude', 'statusline-picker');
const BACKUP_DIR = path.join(INSTALL_DIR, 'backups');
const ACTIVE_SCRIPT = path.join(INSTALL_DIR, 'active.mjs');
const ACTIVE_META = path.join(INSTALL_DIR, 'active.json');
const CONFIG_FILE = path.join(INSTALL_DIR, 'config.json');

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

/** Windows paths must use forward slashes: Git Bash eats unquoted backslashes. */
function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** Write via a temp file + rename so an interrupted run can never truncate settings.json. */
function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}

// ---------------------------------------------------------------- arguments

const argv = process.argv.slice(2);
const flags = new Set();
const positional = [];
let scope = 'user';

for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--scope') {
    // Consume the value so it is not mistaken for a style id.
    scope = argv[i + 1] ?? '';
    i += 1;
  } else if (arg.startsWith('--scope=')) {
    scope = arg.slice('--scope='.length);
  } else if (arg.startsWith('--')) {
    flags.add(arg);
  } else {
    positional.push(arg);
  }
}

if (scope !== 'user' && scope !== 'project') {
  fail(`--scope must be "user" or "project", got "${scope}"`);
}

const settingsFile =
  scope === 'user'
    ? path.join(os.homedir(), '.claude', 'settings.json')
    : path.join(process.cwd(), '.claude', 'settings.json');

const gallery = readJson(path.join(pluginRoot, 'styles.json'));
const pluginVersion = readJson(path.join(pluginRoot, '.claude-plugin', 'plugin.json')).version;

// ---------------------------------------------------------------- settings io

/**
 * Never overwrite a settings.json we could not parse: re-serializing a file we
 * misread would destroy the user's configuration.
 */
function loadSettings(file) {
  if (!existsSync(file)) return {};
  let raw;
  try {
    raw = readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${toPosix(file)}: ${error.message}`);
  }
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      fail(`${toPosix(file)} does not contain a JSON object — refusing to overwrite it`);
    }
    return parsed;
  } catch (error) {
    fail(
      `${toPosix(file)} is not valid JSON (${error.message}).\n` +
        'Refusing to write. Fix or move the file, then run this again.',
    );
  }
}

function backupSettings(file) {
  if (!existsSync(file)) return null;
  mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(BACKUP_DIR, `settings-${scope}-${stamp}.json`);
  copyFileSync(file, target);
  pruneBackups();
  return target;
}

/** Keep the 20 most recent backups per scope; older ones are noise. */
function pruneBackups() {
  try {
    const keep = 20;
    const stale = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith(`settings-${scope}-`))
      .sort()
      .reverse()
      .slice(keep);
    for (const file of stale) rmSync(path.join(BACKUP_DIR, file), { force: true });
  } catch {
    // Pruning is housekeeping; never let it abort an install.
  }
}

function saveSettings(file, settings) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeJsonAtomic(file, settings);
}

// ---------------------------------------------------------------- node lookup

/**
 * Prefer the bare `node` command so the status line follows version-manager
 * switches, but fall back to this interpreter's absolute path when `node` is
 * not on PATH — otherwise the status line would silently print nothing.
 */
function resolveNodeCommand() {
  try {
    execFileSync('node', ['--version'], { stdio: 'ignore', timeout: 5000, windowsHide: true });
    return { command: 'node', onPath: true };
  } catch {
    return { command: `"${toPosix(process.execPath)}"`, onPath: false };
  }
}

// ---------------------------------------------------------------- commands

function readActiveMeta() {
  try {
    return readJson(ACTIVE_META);
  } catch {
    return null;
  }
}

function showStatus() {
  const meta = readActiveMeta();
  const settings = loadSettings(settingsFile);

  console.log(`settings file : ${toPosix(settingsFile)}`);
  console.log(`install dir   : ${toPosix(INSTALL_DIR)}`);
  console.log(
    `statusLine    : ${settings.statusLine ? JSON.stringify(settings.statusLine) : '(not set)'}`,
  );

  if (!meta) {
    console.log('active style  : (none installed by this plugin)');
    return;
  }
  console.log(`active style  : ${meta.styleId}`);
  console.log(`installed at  : ${meta.installedAt}`);
  console.log(`plugin version: ${meta.pluginVersion}`);
  if (meta.pluginVersion !== pluginVersion) {
    console.log(
      `\nNOTE: the active copy was made from plugin ${meta.pluginVersion} but ${pluginVersion} is installed.\n` +
        `Re-run the picker with "${meta.styleId}" to refresh it.`,
    );
  }
}

function listStyles() {
  for (const style of gallery.styles) {
    console.log(`${style.id}\t${style.name}\t${style.description}`);
  }
}

function restoreBackup() {
  if (!existsSync(BACKUP_DIR)) fail('no backups found');
  const backups = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(`settings-${scope}-`))
    .sort()
    .reverse();
  if (backups.length === 0) fail(`no backups found for scope "${scope}"`);

  const newest = path.join(BACKUP_DIR, backups[0]);
  const restored = readJson(newest); // Validate before writing it back.
  saveSettings(settingsFile, restored);
  console.log(`Restored ${toPosix(settingsFile)} from ${backups[0]}`);
  console.log(
    `statusLine is now: ${restored.statusLine ? JSON.stringify(restored.statusLine) : '(not set)'}`,
  );
  console.log('\nRestart Claude Code for the change to take effect.');
}

function removeStatusLine() {
  const settings = loadSettings(settingsFile);
  if (!settings.statusLine) {
    console.log(`No statusLine set in ${toPosix(settingsFile)} — nothing to remove.`);
    return;
  }
  const previous = settings.statusLine;
  const backup = backupSettings(settingsFile);
  delete settings.statusLine;
  saveSettings(settingsFile, settings);

  console.log(`Removed statusLine from ${toPosix(settingsFile)}`);
  console.log(`Previous value: ${JSON.stringify(previous)}`);
  if (backup) console.log(`Backup: ${toPosix(backup)}`);
  console.log('\nRestart Claude Code for the change to take effect.');
}

function installStyle(styleId) {
  const style = gallery.styles.find((s) => s.id === styleId);
  if (!style) {
    fail(
      `unknown style "${styleId}".\nAvailable: ${gallery.styles.map((s) => s.id).join(', ')}`,
    );
  }

  const source = path.join(pluginRoot, style.file);
  if (!existsSync(source)) {
    fail(`build output missing: ${style.file}\nRun \`npm run build\` in ${toPosix(pluginRoot)}`);
  }

  // Validate settings.json BEFORE touching anything on disk, so a broken file
  // leaves the install directory untouched too.
  const settings = loadSettings(settingsFile);
  const previous = settings.statusLine ?? null;

  mkdirSync(INSTALL_DIR, { recursive: true });
  copyFileSync(source, ACTIVE_SCRIPT);
  writeJsonAtomic(ACTIVE_META, {
    styleId: style.id,
    name: style.name,
    pluginVersion,
    installedAt: new Date().toISOString(),
    sourcePath: toPosix(source),
  });

  // Seed the config only once: re-activating a style must not discard the
  // user's customisations.
  if (!existsSync(CONFIG_FILE)) {
    copyFileSync(path.join(pluginRoot, 'config.default.json'), CONFIG_FILE);
  }

  const node = resolveNodeCommand();
  const backup = backupSettings(settingsFile);

  settings.statusLine = {
    type: 'command',
    command: `${node.command} "${toPosix(ACTIVE_SCRIPT)}"`,
  };
  saveSettings(settingsFile, settings);

  console.log(`Activated: ${style.id} — ${style.name}`);
  console.log(`Settings : ${toPosix(settingsFile)}`);
  console.log(`Script   : ${toPosix(ACTIVE_SCRIPT)}`);
  console.log(`Config   : ${toPosix(CONFIG_FILE)}`);
  if (backup) console.log(`Backup   : ${toPosix(backup)}`);
  console.log(`Previous : ${previous ? JSON.stringify(previous) : '(none)'}`);
  if (!node.onPath) {
    console.log(
      `\nNOTE: \`node\` is not on PATH, so the absolute interpreter path was used.\n` +
        'If you move or upgrade Node, re-run the picker.',
    );
  }
  if (style.requiresNerdFont) {
    console.log('\nNOTE: this style needs a Nerd Font for its separators to render.');
  }
  console.log('\nRestart Claude Code for the change to take effect.');
}

// ---------------------------------------------------------------- dispatch

if (flags.has('--status')) {
  showStatus();
} else if (flags.has('--list')) {
  listStyles();
} else if (flags.has('--restore')) {
  restoreBackup();
} else if (flags.has('--remove')) {
  removeStatusLine();
} else if (positional.length === 1) {
  installStyle(positional[0]);
} else {
  fail(
    'usage: install-style.mjs <style-id> [--scope user|project]\n' +
      '       install-style.mjs --status | --list | --restore | --remove [--scope ...]',
  );
}
