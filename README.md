# cc-status-line-picker

A gallery of ready-to-use status lines for [Claude Code](https://code.claude.com/docs),
with an interactive picker to switch between them.

Claude Code supports exactly one `statusLine` entry in `settings.json`. This plugin
doesn't change that — it ships nine ready-made styles and gives you a safe way to
activate any one of them, with backups and a one-command undo.

## Requirements

- **Claude Code** v2.1.153 or later (styles use the `COLUMNS` env var to size themselves)
- **Node.js** 18+ available as `node` on your PATH

No `jq`, no build step, no runtime dependencies. Styles ship pre-built.

## Install

```
/plugin marketplace add Priotts/cc-status-line-picker
/plugin install cc-status-line-picker@cc-status-line-picker
```

## Use

```
/statusline-pick
```

Pick a category, pick a variant, done. You can also just ask in plain language —
*"give me a status line with git and my session cost"*, *"put my old status line
back"*, *"make the context bar wider"* — and Claude will route it to the right skill.

To look without committing to anything:

```
/statusline-preview
```

**Restart Claude Code after activating a style.** Settings reload automatically,
but the status line command is picked up on the next session.

## The gallery

Rendered below without color. Live output is colored, and thresholds turn values
yellow at 70% and red at 90%.

### minimal — essential information, small footprint

```
minimal/basic     ◆ Opus · my-project · 38% ctx · 5h 24% · 7d 41%
minimal/compact   my-project 38%
```

`basic` covers model, directory, context usage and both rate-limit windows on one
line. `compact` is the shortest useful status line there is: directory and context
percentage, no colors, no icons.

### git — branch, working tree, worktrees and pull requests

```
git/branch   ▸ my-project ⎇ main*
git/full     ▸ my-project ⎇ main ↑2 ↓1 ●3 ○1 ?2 ⧉ feature-xyz ⑂ #1234 pending
```

`branch` shows a single `*` when anything is uncommitted. `full` breaks it down:
`↑↓` divergence from upstream, `●` staged, `○` modified, `?` untracked, plus the
worktree name when you're inside one and the open PR for the branch with its
review state.

### usage — context window, tokens, cost and rate limits

```
usage/tokens   ▤ ████░░░░░░ 38% · 76k/200k · in 75k out 1.2k
usage/cost     $0.42 · ◴ 12m · +156 -23 · 5h 24% (4h11m) · 7d 41% (2d5h)
```

`tokens` reads the real context window size, so a 1M-context model shows `/1M`
rather than pretending everything is 200k. `cost` counts session spend, wall-clock
duration, lines changed, and how long until each rate-limit window resets.

### fancy — colorful, icon-rich, optionally multi-line

```
fancy/powerline    ◆ Opus  my-project  ⎇ main*  38% 

fancy/multiline   ◆ Opus ▸ my-project ⎇ main ●3 ○1 ⑂ #1234
                  ▤ ████░░░░░░ 38% · $0.42 · 5h 24% (4h11m) · 7d 41% (2d5h)
```

> **`fancy/powerline` requires a [Nerd Font](https://www.nerdfonts.com/).** Its
> separators are U+E0B0; without a patched font they render as missing-glyph
> boxes. Every other style uses plain Unicode.

`multiline` splits identity and repository state onto the first line and
consumption onto the second. Each line truncates independently, so a narrow
terminal loses detail rather than wrapping.

```
fancy/dashboard   ◆ Opus ▸ my-project ⎇ main ●3 ○1 ?2
                  ctx ███████████▊░░ 84%   169k/200k  $2.71 ◴ 1h48m +892 -310
                   5h █████████▉░░░░ 71%   resets 21:28 (3h39m)  ▲ on pace for 266%
                   7d ██████▏░░░░░░░ 44%   resets Fri 17:48 (4d23h)  ▲ on pace for 154%
```

`dashboard` puts the context window and both rate-limit windows on one scale,
stacked, so you can see which will run out first. It is the only style using
partial blocks (`▏▎▍▌▋▊▉`), which give eight times the resolution in the same
width.

The projection answers the question a raw percentage cannot: *am I going too
fast?* It compares how much of the window you have consumed against how much of
it has elapsed, and turns red when you are on course to exhaust it before it
resets. So `88%` with fifteen minutes left reads `▸ on pace for 93%` — alarming
number, fine situation — while `71%` with most of the window still ahead reads
`▲ on pace for 266%`.

Nothing is projected until a fifth of the window has elapsed; before that, a
short burst would produce a frightening and meaningless number.

> The projection assumes each rate-limit window is **fixed** — it starts, runs
> for its nominal length, and resets — so that elapsed time can be derived from
> `resets_at` alone. If these windows turn out to slide instead, the projection
> is wrong and should be removed. See `projectedUsage` in
> `src/styles/fancy-dashboard.ts`.

## Customizing

Colors, icons, separators, bar width, thresholds and section toggles live in:

```
~/.claude/statusline-picker/config.json
```

It's created on first install and **never overwritten** afterwards, so your edits
survive switching styles. Every key is optional — anything you omit, or get wrong,
falls back to the default rather than breaking the status line.

```jsonc
{
  "colors": { "accent": "cyan", "ok": "green", "warn": "yellow", "danger": "red", "muted": "gray" },
  "icons":  { "branch": "⎇", "folder": "▸", "staged": "●", "modified": "○" },
  "separator": " · ",
  "barWidth": 10,
  "barChars": { "filled": "█", "empty": "░" },
  "showModel": true,
  "showGit": true,
  "showCost": true,
  "showLimits": true,
  "thresholds": { "warn": 70, "danger": 90 }
}
```

Colors accept a name (`"cyan"`), a 256-color index (`"123"`), or a raw SGR
sequence (`"38;5;123"`). `config.default.json` in this repo is the full reference.

Changes apply on the next status line refresh — no reinstall needed. Setting
[`NO_COLOR`](https://no-color.org) strips all color from every style.

## Undo

| Goal | Ask Claude, or run directly |
|---|---|
| See what's active | `node <plugin>/scripts/install-style.mjs --status` |
| Restore the previous status line | `node <plugin>/scripts/install-style.mjs --restore` |
| Remove the status line entirely | `node <plugin>/scripts/install-style.mjs --remove` |

Every write to `settings.json` is backed up first to
`~/.claude/statusline-picker/backups/` (the last 20 are kept). If your
`settings.json` isn't valid JSON, the installer refuses to write rather than
risking your configuration.

Add `--scope project` to any of these to target `.claude/settings.json` in the
current project instead of `~/.claude/settings.json`.

## How activation works

The picker **copies** the chosen style to `~/.claude/statusline-picker/active.mjs`
and points `statusLine.command` at that copy. It does not reference the plugin
directory, for two reasons:

1. `${CLAUDE_PLUGIN_ROOT}` is not expanded inside `settings.json` — it only
   resolves within plugin components (skills, hooks, MCP, LSP).
2. A plugin's installation path changes on every update, and the old directory is
   eventually deleted.

Either way, a path into the plugin would break. Each style is bundled into a
self-contained file precisely so a single copy works on its own.

The trade-off: after a plugin update your active copy stays on the old version.
`--status` tells you when that's the case; re-running the picker on the same style
refreshes it.

## Contributing a style

1. Add `src/styles/<your-style>.ts`. Import `run` from `../lib/input.js` — it
   parses stdin and guarantees a style that throws still prints something.
2. Add an entry to `styles.json` (`id`, `category`, `name`, `description`, `file`,
   `lines`, `requiresNerdFont`). That file is the single source of truth for the
   picker, the preview, the tests and this README.
3. `npm install && npm run build && npm test`
4. **Commit `dist/`.** Users install the plugin without a build step, so the
   built output is part of the distribution.

Style contract, enforced by `npm test` across nine stdin payloads:

- never crash — stderr isn't displayed, so a crash is an invisible failure
- always print something — an empty status bar should always mean a real bug
- respect `COLUMNS` — truncate, never wrap
- emit no ANSI escapes when `NO_COLOR` is set
- treat every input field as possibly missing or `null`

New categories are welcome; add them to `categories` in `styles.json`.

## Layout

```
.claude-plugin/plugin.json       plugin manifest
.claude-plugin/marketplace.json  marketplace manifest (source "./")
src/                             TypeScript sources — types, shared lib, styles
dist/styles/*.mjs                built, self-contained styles (committed)
styles.json                      gallery manifest
skills/                          statusline-pick, statusline-preview
scripts/install-style.mjs        writes settings.json — backups, validation, atomic
scripts/preview.mjs              renders styles against a sample session
scripts/test-styles.mjs          smoke tests
config.default.json              generated from src/lib/config.ts at build time
```

## License

MIT — see [LICENSE](LICENSE).
