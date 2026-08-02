/**
 * usage/pace — one line: where you are, and where you are heading.
 *
 *   ◆ Opus high · ▸ my-project · ⎇ main · ctx 38% · 5h 24% (01:31) · 7d 41%→60% (Wed 03:19)
 *   ◆ Opus max ⚡ · ▸ my-project · ⎇ main* · ctx 84% · 5h 71%→266% (21:28) · 7d 44%→154% (Fri 20:05)
 *
 * The same projection `fancy/dashboard` shows, without the bars. The bars are
 * what cost space; the projection is what carries information nothing else
 * here can give you — a percentage on its own cannot tell you whether 71% is
 * worse than 88%, and it usually is.
 *
 * Everything is grey except the numbers, so the eye lands on the values rather
 * than the scaffolding, and red appears only when a window would run out before
 * it resets.
 */
import { run } from '../lib/input.js';
import { loadConfig } from '../lib/config.js';
import { c, byThreshold } from '../lib/ansi.js';
import { getGitInfo } from '../lib/git.js';
import { basename, join, pct, printLines } from '../lib/format.js';
import { paceSegment } from '../lib/segments.js';

run((input) => {
  const cfg = loadConfig();
  const cwd = input.workspace?.current_dir ?? input.cwd ?? null;
  const parts: Array<string | null> = [];

  // Model, reasoning effort and fast mode read as one thing — "what am I
  // talking to" — so they share a segment rather than three.
  if (cfg.showModel && input.model?.display_name) {
    const effort = input.effort?.level ? c.muted(` ${input.effort.level}`) : '';
    const fast = input.fast_mode ? c.warn(` ${cfg.icons.fast}`) : '';
    parts.push(c.muted(`${cfg.icons.model} `) + input.model.display_name + effort + fast);
  }

  parts.push(c.accent(`${cfg.icons.folder} ${basename(cwd)}`));

  const git = cfg.showGit ? getGitInfo(cwd) : null;
  if (git) {
    // A single marker rather than counters: this style is about consumption,
    // and the git styles already cover working-tree detail.
    parts.push(c.muted(`${cfg.icons.branch} ${git.branch}`) + (git.clean ? '' : c.warn('*')));
  }

  const ctx = pct(input.context_window?.used_percentage);
  parts.push(c.muted('ctx ') + byThreshold(ctx, `${Math.round(ctx)}%`));

  if (cfg.showLimits) {
    parts.push(paceSegment('5h', input.rate_limits?.five_hour));
    parts.push(paceSegment('7d', input.rate_limits?.seven_day));
  }

  printLines([join(parts)]);
});
