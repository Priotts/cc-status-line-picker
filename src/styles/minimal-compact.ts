/**
 * minimal/compact — the shortest useful status line: directory and context
 * percentage, nothing else. Colorless by design so it never competes with the
 * conversation for attention.
 *
 *   my-project 38%
 */
import { run } from '../lib/input.js';
import { basename, pct, printLines } from '../lib/format.js';

run((input) => {
  const dir = basename(input.workspace?.current_dir ?? input.cwd);
  const ctx = Math.round(pct(input.context_window?.used_percentage));
  printLines([`${dir} ${ctx}%`]);
});
