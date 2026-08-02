/**
 * git/branch — directory and branch, with a single marker for uncommitted work.
 * The lightest git-aware option: one call, no counts to parse visually.
 *
 *   ▸ my-project ⎇ main*
 */
import { run } from '../lib/input.js';
import { loadConfig } from '../lib/config.js';
import { c } from '../lib/ansi.js';
import { getGitInfo } from '../lib/git.js';
import { basename, join, printLines } from '../lib/format.js';

run((input) => {
  const cfg = loadConfig();
  const cwd = input.workspace?.current_dir ?? input.cwd ?? null;
  const parts: Array<string | null> = [c.accent(`${cfg.icons.folder} ${basename(cwd)}`)];

  const git = cfg.showGit ? getGitInfo(cwd) : null;
  if (git) {
    const dirty = git.clean ? '' : c.warn('*');
    parts.push(`${c.muted(cfg.icons.branch)} ${c.ok(git.branch)}${dirty}`);
  }

  printLines([join(parts, ' ')]);
});
