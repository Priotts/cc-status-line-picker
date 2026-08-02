/**
 * usage/tokens — how full the context window is, in both a bar and raw counts.
 * Adapts to the actual window size, so a 1M-context model reads correctly
 * instead of pretending everything is 200k.
 *
 *   ▤ ████░░░░░░ 38% · 76.0k/200k · in 15.5k out 1.2k
 */
import { run } from '../lib/input.js';
import { loadConfig } from '../lib/config.js';
import { c, byThreshold } from '../lib/ansi.js';
import { bar, compactNumber, join, pct, printLines } from '../lib/format.js';

run((input) => {
  const cfg = loadConfig();
  const ctx = input.context_window;
  const used = pct(ctx?.used_percentage);
  const size = ctx?.context_window_size ?? 200_000;
  const parts: Array<string | null> = [];

  parts.push(
    `${c.muted(cfg.icons.context)} ${byThreshold(used, bar(used))} ${byThreshold(used, `${Math.round(used)}%`)}`,
  );

  const inTokens = ctx?.total_input_tokens ?? 0;
  const outTokens = ctx?.total_output_tokens ?? 0;
  const total = inTokens + outTokens;
  if (total > 0) {
    parts.push(c.muted(`${compactNumber(total)}/${compactNumber(size)}`));
    parts.push(
      c.muted('in ') + compactNumber(inTokens) + c.muted(' out ') + compactNumber(outTokens),
    );
  } else {
    parts.push(c.muted(`window ${compactNumber(size)}`));
  }

  // Fixed 200k threshold, independent of the real window size: worth flagging
  // because some behaviour keys off it regardless of the model's capacity.
  if (input.exceeds_200k_tokens) parts.push(c.warn('>200k'));

  printLines([join(parts)]);
});
