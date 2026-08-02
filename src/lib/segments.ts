/**
 * Composite segments shared by more than one style.
 */
import { loadConfig } from './config.js';
import { c, byThreshold } from './ansi.js';
import { pct, resetsIn, resetsAtClock } from './format.js';
import type { RateLimitWindow } from '../types.js';

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
