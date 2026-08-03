---
name: statusline-pick
description: Browse the status line gallery and activate one. Use when the user wants to change, choose, configure, customize, preview-then-set, restore or remove their Claude Code status line — including natural-language requests like "I want a status line with git and costs", "make my status bar show tokens", "put my old status line back", or "get rid of the status line".
allowed-tools: Bash, Read, AskUserQuestion
---

# Status line picker

Help the user choose a status line from this plugin's gallery and activate it.

All paths below use `${CLAUDE_PLUGIN_ROOT}`, which expands to this plugin's
installation directory.

## Step 1 — Render the gallery

Run this once and use its output for everything that follows:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs" --json
```

It returns an array of `{ id, category, name, description, requiresNerdFont, output, error }`.
The `output` field is the style rendered against a sample session, using the
**current working directory** so git-aware styles show real branch data.

If every entry has an `error` mentioning missing build output, the plugin was
installed without its `dist/` directory — tell the user to report it as a
packaging bug rather than trying to build it yourself.

## Step 2 — Understand what they want

If the user already named a style (`git/full`) or was specific enough to make the
choice obvious ("I want git info and my spend"), skip straight to Step 3.

Otherwise use **AskUserQuestion** in exactly two steps. A question caps at four
options and there are more styles than that, so asking about styles directly
would silently hide part of the gallery and the user would never learn the rest
exists.

**Step 2a — the categories.** Build the options from the `category` field of the
Step 1 output, one option per distinct category, never a subset. Do not work from
a list written here; categories and their contents change, and this file has no
way of knowing.

Put **every** variant of that category in the option's `preview` field, labelled
by variant name, so the user sees the whole category before committing to it. A
category can hold more than two.

**Step 2b — the variants** of the chosen category, one option each, with each
style's rendered `output` as its `preview`. If a category ever holds more than
four, group the weakest fits under one option and expand on request rather than
dropping any.

Skip 2a only when the user's request already narrows things to one category; go
straight to 2b in that case.

Strip the ANSI escape sequences out of `output` before putting it in a `preview`
field — previews render as plain monospace text, so the raw codes would show as
visible garbage.

Note which styles have `requiresNerdFont: true` — mention the font requirement in
that option's description so nobody picks a style that renders as boxes.

## Step 3 — Activate

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/install-style.mjs" <style-id>
```

Add `--scope project` to write to `.claude/settings.json` in the current project
instead of the user's `~/.claude/settings.json`. Default to user scope; only use
project scope if the user asks for this project only.

The installer handles backups, validation and atomic writes on its own. Do **not**
edit `settings.json` yourself — a hand-edit skips the safety checks.

Report back: which style is now active, and that **Claude Code must be restarted**
for the change to appear.

## Other requests

| The user wants | Run |
|---|---|
| to see what is active now | `node "${CLAUDE_PLUGIN_ROOT}/scripts/install-style.mjs" --status` |
| their previous status line back | `node "${CLAUDE_PLUGIN_ROOT}/scripts/install-style.mjs" --restore` |
| no status line at all | `node "${CLAUDE_PLUGIN_ROOT}/scripts/install-style.mjs" --remove` |
| to change colors, icons or thresholds | Edit `~/.claude/statusline-picker/config.json` (see below) |

`--status`, `--restore` and `--remove` also accept `--scope project`.

## Customizing an active style

Colors, icons, separators, bar width, thresholds and section toggles live in
`~/.claude/statusline-picker/config.json`, created on first install. Read it,
edit the keys the user asked about, and leave the rest alone. Changes apply on
the next status line refresh — no reinstall needed.

Every key is optional and anything invalid silently falls back to the default, so
a partial file is fine. `~/.claude/statusline-picker/config.json` is the user's
copy; `${CLAUDE_PLUGIN_ROOT}/config.default.json` is the reference template.

## If the active copy is stale

`--status` warns when the active script was copied from an older plugin version.
The fix is to re-run the install command for the same style id, which refreshes
the copy.
