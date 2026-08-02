# cc-status-line-picker

Claude Code supports exactly one `statusLine` entry in `settings.json`. This plugin
doesn't change that — it ships ten ready-made status lines and a picker that activates
any one of them, keeping a timestamped backup of your settings and a one-command undo.

Rendered gallery, if you'd rather look than read:
<https://priotts.github.io/cc-status-line-picker-site/>

## Install

Node 18 or newer, available as `node` on your PATH. That's the whole list — no `jq`, no
runtime dependencies, no build step, since `dist/` is committed. git is optional: styles
that show branch state omit the section when git is missing or the directory isn't a
repository. macOS, Linux and Windows are all tested in CI.

```
/plugin marketplace add Priotts/cc-status-line-picker
/plugin install cc-status-line-picker@cc-status-line-picker
```

Then, inside Claude Code:

```
/statusline-pick
```

Two questions — category, then variant — and it writes the change. `/statusline-preview`
renders the gallery and touches nothing. Both are skills rather than fixed commands, so
plain language reaches them too: *"give me a status line with git and my session cost"*,
*"put my old status line back"*, *"get rid of the status line"*.

Restart Claude Code after activating. The `statusLine` command is read when a session
starts, so an already-running one keeps the old bar.

## The gallery

Real output, produced by running the styles against the sample session in
`examples/session.json` — not mockups. Color is stripped here; live output is colored,
and numbers turn yellow at 70% and red at 90%.

### minimal

```
minimal/basic     ◆ Opus · my-project · 38% ctx · 5h 24% · 7d 41%
minimal/compact   my-project 38%
```

`basic` is model, directory, context percentage and both rate-limit windows. `compact`
is two fields and no escape codes at all — colorless by design, so it never competes
with the conversation for attention. Neither one shells out to git.

### git

```
git/branch   ▸ my-project ⎇ main*
git/full     ▸ my-project ⎇ main ↑2↓1 ●3 ○1 ?2 ⧉ feature-xyz ⑂ #1234 pending
```

`branch` adds a single `*` when anything is uncommitted, and nothing at all when the
tree is clean. `full` breaks it out: `↑↓` divergence from upstream, `●` staged, `○`
modified, `?` untracked, the worktree name when you're inside one, and the open PR for
the branch with its review state (green when approved, red on changes requested). With
no changes it prints the word `clean` rather than leaving a gap. The PR number and
review state arrive in Claude Code's stdin payload; the `gh` CLI is not involved.

### usage

```
usage/tokens   ▤ ████░░░░░░ 38% · 76k/200k · in 75k out 1.2k
usage/cost     $0.42 · ◴ 12m · +156 -23 · 5h 24% (4h11m · 01:16) · 7d 41% (2d5h · Wed 03:04)
```

`tokens` reads the real context window size, so a 1M-context model shows `/1M` instead
of pretending everything is 200k. It flags `>200k` separately when the payload sets
`exceeds_200k_tokens`, because that threshold is fixed regardless of the model's actual
capacity and some behaviour keys off it.

`cost` gives each rate limit both a countdown and a wall-clock time. The countdown
answers "how long do I have", the clock answers "when can I start again"; neither
replaces the other. Set `showResetTime: false` to drop the clock.

```
usage/pace   ▸ my-project · ⎇ main* · ctx 38% · 5h 24% · 7d 41%→60%
             ▸ my-project · ⎇ main* · ctx 84% · 5h 71%→266% · 7d 44%→154%
```

`pace` is `fancy/dashboard`'s projection without the bars, on one line. `71%→266%` reads
as "you're at 71, heading for 266"; the arrow and the number turn red together, and only
when a window would be exhausted before it resets, so red means one thing. When there
isn't enough elapsed window to project, the arrow is simply absent and the segment gets
shorter — which is why the first line above has none on `5h`.

### fancy

```
fancy/powerline    ◆ Opus  my-project  ⎇ main*  38% 
```

Filled background segments joined by U+E0B0. Without a [Nerd Font](https://www.nerdfonts.com/)
those separators are missing-glyph boxes, which is why this is the only style flagged
`requiresNerdFont` and why the picker says so before you choose it. Every other style
sticks to plain Unicode. It also ignores `config.colors` on purpose and uses its own
256-color palette: the semantic colors are picked to work as foregrounds and read badly
as segment backgrounds.

```
fancy/multiline   ◆ Opus ▸ my-project ⎇ main ●3 ○1 ⑂ #1234
                  ▤ ████░░░░░░ 38% · $0.42 · 5h 24% (4h11m · 01:16) · 7d 41% (2d5h · Wed 03:04)
```

Identity and repository state above, consumption below. Each line truncates
independently, so a narrow terminal loses detail rather than wrapping.

```
fancy/dashboard   ◆ Opus ▸ my-project ⎇ main ●3 ○1 ?2
                  ctx ███████████▊░░ 84%   169k/200k  $2.71 ◴ 1h48m +892 -310
                   5h █████████▉░░░░ 71%   resets 00:44 (3h38m)  ▲ on pace for 263%
                   7d ██████▏░░░░░░░ 44%   resets Fri 20:05 (4d22h)  ▲ on pace for 151%
```

Four lines, three gauges on one scale, so you can see which window runs out first. It's
the only style using partial blocks (`▏▎▍▌▋▊▉`), which give eight times the resolution
in the same width, and the only one whose columns are a hand-built grid: three-character
label, bar, then the percentage padded to four, because `100%` is four characters wide
and that is what keeps the rows aligned at every value.

The projection answers what a raw percentage cannot — am I going too fast? It compares
how much of a window you've consumed against how much of it has elapsed. `88%` with
fifteen minutes left reads `▸ on pace for 93%`: an alarming number and a fine situation.
`71%` with three and a half hours still to run reads `▲ on pace for 263%`. Red tracks
trajectory, not level, which is how a 7d window at 44% ends up in red above. Nothing is
projected until a fifth of a window has elapsed; before that, dividing by a small
fraction turns a short burst into a frightening and meaningless number. See the design
notes below for the assumption this rests on.

## Commands

The two skills run these for you. They're plain Node scripts, so you can also run them
by hand from a clone of this repository or from the plugin's installed directory:

| Command | Effect |
|---|---|
| `node scripts/preview.mjs` | Render the whole gallery. Style ids as arguments render only those. |
| `node scripts/preview.mjs --json` | Same, as `{id, category, name, description, requiresNerdFont, output, error}`. |
| `node scripts/install-style.mjs <style-id>` | Activate a style. |
| `node scripts/install-style.mjs --list` | Tab-separated id, name, description. |
| `node scripts/install-style.mjs --status` | Active style, install paths, plugin version. |
| `node scripts/install-style.mjs --restore` | Put the newest backup of `settings.json` back. |
| `node scripts/install-style.mjs --remove` | Delete the `statusLine` key and leave the rest alone. |

Everything except `preview.mjs` takes `--scope user|project`. The default is `user`
(`~/.claude/settings.json`); `project` targets `.claude/settings.json` in the current
directory. Neither script has a `--help`; the usage line you get from a bad invocation
is all there is.

### What the installer guarantees

`settings.json` is parsed and checked before anything is written anywhere, including
into the install directory — re-serialising a file it misread would destroy your
configuration, so a file that isn't valid JSON aborts the run with a message and a
non-zero exit. The write itself goes to a temp file in the same directory and is then
renamed over the target, so an interrupted run can't truncate the file. The previous
contents are copied to `~/.claude/statusline-picker/backups/settings-<scope>-<timestamp>.json`
first, and the newest 20 per scope are kept.

One asymmetry worth knowing: `--restore` does not back up the file it overwrites.
Activating a style and `--remove` both do, so `--remove` followed by `--restore` round
trips cleanly, but restoring twice restores the same backup twice.

The command written into `settings.json` is the bare word `node` when `node` is on your
PATH, so the status line follows nvm/fnm/volta switches. When it isn't, the absolute
path of the current interpreter is baked in and the installer warns you to re-run the
picker if you move or upgrade Node. Paths are always written with forward slashes,
including on Windows, because Git Bash eats unquoted backslashes.

## Configuration

```
~/.claude/statusline-picker/config.json
```

Seeded from `config.default.json` on first activation and never overwritten afterwards,
so your edits survive both switching styles and updating the plugin. Every key is
optional; each section is merged key by key, so overriding one icon doesn't drop the
rest. Anything missing, misspelled or of the wrong type falls back to the default
without comment — a bad config never breaks the bar.

```jsonc
{
  "colors": { "accent": "cyan", "ok": "green", "warn": "yellow", "danger": "red", "muted": "gray" },
  "icons": {
    "branch": "⎇", "model": "◆", "folder": "▸", "context": "▤", "cost": "$", "clock": "◴",
    "added": "+", "removed": "-", "staged": "●", "modified": "○", "untracked": "?",
    "ahead": "↑", "behind": "↓", "pr": "⑂", "worktree": "⧉", "fast": "⚡"
  },
  "separator": " · ",
  "barWidth": 10,
  "barChars": { "filled": "█", "empty": "░" },
  "showModel": true,
  "showGit": true,
  "showCost": true,
  "showLimits": true,
  "showResetTime": true,
  "thresholds": { "warn": 70, "danger": 90 }
}
```

Colors accept a name (`"cyan"`), a 256-color index (`"123"`), or a raw SGR sequence
(`"38;5;123"`). `barWidth` is clamped to 40. Changes apply on the next refresh; no
reinstall. Setting [`NO_COLOR`](https://no-color.org) strips every escape sequence from
every style.

Three things about this file that surprise people:

- Reset times use the system locale, so `Wed 03:04` above may read `mer 03:04` or
  `1:16 AM` on your machine. The weekday only appears past 24 hours, because a bare
  `18:30` two days out is ambiguous.
- `fancy/dashboard` widens its bars to 14 cells unless `barWidth` differs from the
  default of 10. Writing `"barWidth": 10` explicitly is indistinguishable from writing
  nothing, so it still gets 14.
- `config.json` is resolved next to the running script, never from the working
  directory. That's what makes the installed copy work from any cwd — and it also means
  `preview.mjs` and the tests, which run the bundles out of the repo, always render with
  the built-in defaults rather than your settings.

## Design notes

### The active style is a copy, not a reference

Activating writes the chosen bundle to `~/.claude/statusline-picker/active.mjs` and
points `statusLine.command` at that file. It never points into the plugin directory, for
two independent reasons: `${CLAUDE_PLUGIN_ROOT}` is not expanded inside `settings.json`
(it only resolves within plugin components — skills, hooks, MCP, LSP), and a plugin's
installation path changes on every update, with the old directory eventually deleted. A
path into the plugin would fail immediately on the first count and silently on the
second.

That constraint is why esbuild emits fully self-contained bundles: the copy has no
`node_modules`, no sibling `src/lib/`, no repository around it. Node builtins are the
only imports that survive. They're built unminified, so you can read what runs in your
shell on every message.

The trade-off is real: after a plugin update your active copy stays on the old version,
and fixes or new styles don't reach it. `--status` compares the `pluginVersion` recorded
in `active.json` against the installed plugin and tells you when they differ. Re-running
the picker on the same style id refreshes the copy.

### Git state is fetched once and cached for two seconds

The status line re-runs on every assistant message, and Claude Code's own docs warn that
`git status` is slow enough to cause visible lag. Two mitigations. First, one invocation
does everything: `git status --porcelain=v1 --branch --untracked-files=normal` yields the
branch, ahead/behind and all three file counts together. Only a detached HEAD costs a
second call. Second, the parsed result is cached in a temp file keyed by a hash of the
working directory, with a 2s TTL and a 1.5s timeout on the git call itself.

Failures are cached too. "Not a repository", "git isn't installed" and "git timed out"
are indistinguishable from here and handled identically — the section is omitted — so
caching the `null` is what stops a non-repo directory from re-shelling out forever.

### The projection assumes a fixed window

Nothing in the stdin payload says when a rate-limit window *started*. `fancy/dashboard`
reconstructs the elapsed fraction as `(nominalLength − timeUntilReset) / nominalLength`,
which is only meaningful if these windows are **fixed** buckets: one starts, runs for its
nominal length, resets. If they slide instead, the elapsed fraction measures nothing and
every projection is wrong — in which case the feature should be deleted, not tuned. It's
falsifiable by watching `resets_at`: a fixed window holds steady for hours and then
jumps, a sliding one creeps continuously. Guards in `projectedUsage`
(`src/lib/segments.ts`, shared by `fancy/dashboard` and `usage/pace`) suppress the
projection when a reset is further out than the window is long, which is one way the
assumption would show itself.

### Rough edges

The git cache files (`cc-slp-git-*.json` in your temp directory, ~135 bytes each, one per
distinct working directory) are never garbage collected. The TTL governs freshness, not
lifetime.

Truncation counts UTF-16 code units, not display columns. Every shipped icon is a
single-width BMP character so it holds, but put an emoji or a CJK character in
`config.icons` and the `COLUMNS` guarantee quietly stops being true.

## Contributing a style

1. Add `src/styles/<your-style>.ts`. Import `run` from `../lib/input.js`; it parses
   stdin and guarantees a style that throws still prints something.
2. Add an entry to `styles.json` — `id`, `category`, `name`, `description`, `file`,
   `lines`, `requiresNerdFont`. That file is the single source of truth for the picker,
   the preview, the tests and this README. New categories go in `categories` there.
3. `npm install && npm run build && npm test`
4. Commit `dist/`. Users install the plugin without a build step, so the built output is
   part of the distribution. CI rebuilds and fails on any diff, which is also why
   `.gitattributes` forces LF — a Windows checkout would otherwise convert `dist/` to
   CRLF and report a build that isn't stale as stale.

Don't hand-edit `config.default.json`. The build regenerates it from `DEFAULT_CONFIG` in
`src/lib/config.ts` so the shipped template and the code reading it can't drift.

`npm test` runs each style against nine stdin payloads — the full sample, `{}`, empty
stdin, non-JSON, a JSON array, all-nulls, a 1M window at 97.4%, expired rate-limit
windows — and enforces the contract:

- never crash, whatever stdin contains; stderr isn't displayed, so a crash is an
  invisible failure
- always print something, so an empty status bar always means a real bug
- respect `COLUMNS`: truncate, never wrap
- emit no ANSI sequences when `NO_COLOR` is set
- treat every input field as possibly missing or `null`

The crash fallback in `run()` is a safety net for users, not for styles: the test asserts
the output does *not* contain `statusline error:`, so a style that relies on it fails CI.

## Layout

```
.claude-plugin/plugin.json       plugin manifest (the authoritative version)
.claude-plugin/marketplace.json  marketplace manifest, source "./"
styles.json                      gallery manifest — the single source of truth
src/                             TypeScript sources: types, shared lib, styles
dist/styles/*.mjs                built, self-contained styles (committed)
config.default.json              generated from src/lib/config.ts at build time
examples/session.json            sample stdin payload used by previews and tests
skills/                          statusline-pick, statusline-preview
scripts/build.mjs                esbuild passes; also regenerates config.default.json
scripts/install-style.mjs        writes settings.json: validation, backup, atomic rename
scripts/preview.mjs              renders styles against the sample session
scripts/test-styles.mjs          the style contract
scripts/test-install.mjs         installs into a sandboxed HOME and runs the result
```

`test-install.mjs` overrides both `$HOME` and `%USERPROFILE%`, then executes the
generated `statusLine.command` through the platform's real shell. That command string is
assembled on one OS and interpreted by another's shell, which is where quoting and path
separators actually break, and it can't be checked by reasoning about it.

## License

MIT — see [LICENSE](LICENSE).
