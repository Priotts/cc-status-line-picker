/**
 * Composite segments shared by more than one style.
 */
import { loadConfig } from './config.js';
import { c, byThreshold } from './ansi.js';
import { pct, resetsIn, resetsAtClock } from './format.js';
import type { RateLimitWindow } from '../types.js';

/** Nominal length of each rate-limit window, in seconds. */
export const WINDOW_SECONDS = { '5h': 5 * 3600, '7d': 7 * 86_400 } as const;

export type WindowLabel = keyof typeof WINDOW_SECONDS;

/**
 * Below this fraction of the window elapsed, a projection is mostly noise:
 * dividing by a small elapsed fraction turns a short burst into an alarming
 * number. Nothing is shown until the window is a fifth of the way through.
 */
const MIN_ELAPSED_FRACTION = 0.2;

/**
 * Projects final usage from the current average rate, keeping no history.
 *
 * ASSUMES A FIXED WINDOW: one that starts, runs for its nominal length and
 * resets, so elapsed time can be derived from `resets_at` alone. If these
 * windows turn out to slide instead, the elapsed fraction is meaningless and
 * this must go. Verifiable by watching `resets_at`: a fixed window holds steady
 * for hours and then jumps, a sliding one creeps continuously.
 *
 * Returns null whenever a projection would be unreliable.
 */
export function projectedUsage(
  used: number,
  resetsAt: number | null | undefined,
  windowSeconds: number,
): number | null {
  if (typeof resetsAt !== 'number' || !Number.isFinite(resetsAt) || resetsAt <= 0) return null;

  const secondsLeft = resetsAt - Date.now() / 1000;
  if (secondsLeft <= 0 || secondsLeft > windowSeconds) return null;

  const elapsed = (windowSeconds - secondsLeft) / windowSeconds;
  if (elapsed < MIN_ELAPSED_FRACTION) return null;

  return used / elapsed;
}

/**
 * One rate-limit window: `5h 24% (4h11m · 18:30)`.
 *
 * The countdown answers "how long do I have", the clock answers "when can I
 * start again" — both are useful and neither replaces the other. Set
 * `showResetTime: false` in config.json to drop the clock and keep it shorter.
 *
 * Returns null when the window is absent, so callers can skip it cleanly.
 */
export function limitSegment(
  label: string,
  window: RateLimitWindow | null | undefined,
): string | null {
  if (typeof window?.used_percentage !== 'number') return null;

  const cfg = loadConfig();
  const used = pct(window.used_percentage);
  const value = byThreshold(used, `${Math.round(used)}%`);

  const left = resetsIn(window.resets_at);
  const clock = cfg.showResetTime ? resetsAtClock(window.resets_at) : '';
  const when = [left, clock].filter(Boolean).join(' · ');

  return c.muted(`${label} `) + value + (when ? c.muted(` (${when})`) : '');
}

/**
 * One rate-limit window as consumed-and-heading-for: `5h 24%` or `5h 71%→266%`.
 *
 * Reads as "you are at 71, heading for 266". The arrow and the projection turn
 * red together, and only when the window would be exhausted before it resets —
 * so on a quiet session the whole line stays green and grey, and red means one
 * thing only.
 *
 * When there is not yet enough elapsed window to project, the arrow is simply
 * absent and the segment gets shorter on its own.
 */
export function paceSegment(
  label: WindowLabel,
  window: RateLimitWindow | null | undefined,
): string | null {
  if (typeof window?.used_percentage !== 'number') return null;

  const used = pct(window.used_percentage);
  const head = c.muted(`${label} `) + byThreshold(used, `${Math.round(used)}%`);

  const projected = projectedUsage(used, window.resets_at, WINDOW_SECONDS[label]);
  if (projected === null) return head;

  const tail = `→${Math.round(projected)}%`;
  return head + (projected > 100 ? c.danger(tail) : c.muted(tail));
}
