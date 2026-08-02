---
name: statusline-preview
description: Show what the gallery's status lines look like without changing anything. Use when the user wants to see, compare or browse the available status line styles — "show me the status line options", "what would the powerline one look like?", "preview the git styles" — and has not asked to activate one.
allowed-tools: Bash
---

# Status line preview

Render gallery styles against a sample session. **This skill never writes to
`settings.json`.** If the user decides they want one of them, hand off to the
`statusline-pick` skill.

## Show everything

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs"
```

Output is grouped by category, with each style's id above its rendered line.

## Show specific styles

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/preview.mjs" git/full usage/cost
```

Valid ids: `minimal/basic`, `minimal/compact`, `git/branch`, `git/full`,
`usage/tokens`, `usage/cost`, `fancy/powerline`, `fancy/multiline`.

## Notes when reporting the result

- Show the rendered lines to the user verbatim, inside a code block, so the ANSI
  colors and alignment survive.
- The sample data is fixed (model, cost, token counts) but the working directory
  and git state are real, so branch and file counts reflect the current repo.
- `fancy/powerline` needs a Nerd Font. Its separators show as boxes otherwise —
  say so if the user is looking at that one.
