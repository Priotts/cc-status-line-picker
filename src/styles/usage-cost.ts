/**
 * usage/cost — what the session has spent so far and how much of your rate
 * limits is left, with a countdown to each reset.
 *
 *   $0.42 · ◴ 12m · +156 -23 · 5h 23% (4h12m) · 7d 41% (2d6h)
 */
import { run } from '../lib/input.js';
import { loadConfig } from '../lib/config.js';
import { c } from '../lib/ansi.js';
import { duration, join, money, printLines } from '../lib/format.js';
import { limitSegment } from '../lib/segments.js';

run((input) => {
  const cfg = loadConfig();
  const parts: Array<string | null> = [];

  if (cfg.showCost) {
    parts.push(c.accent(money(input.cost?.total_cost_usd)));
    parts.push(c.muted(`${cfg.icons.clock} ${duration(input.cost?.total_duration_ms)}`));

    const added = input.cost?.total_lines_added ?? 0;
    const removed = input.cost?.total_lines_removed ?? 0;
    if (added > 0 || removed > 0) {
      parts.push(c.ok(`${cfg.icons.added}${added}`) + ' ' + c.danger(`${cfg.icons.removed}${removed}`));
    }
  }

  if (cfg.showLimits) {
    parts.push(limitSegment('5h', input.rate_limits?.five_hour));
    parts.push(limitSegment('7d', input.rate_limits?.seven_day));
  }

  printLines([join(parts)]);
});
