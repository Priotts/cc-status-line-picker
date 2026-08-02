/**
 * Reads the session JSON from stdin and runs a style safely.
 *
 * Two rules every style depends on:
 *   - a malformed or empty stdin yields an empty object rather than throwing,
 *     so styles still render whatever they can;
 *   - a style that throws prints a minimal fallback line instead of nothing.
 *     A status line that silently disappears is very hard to debug, and the
 *     docs note that stderr is not displayed.
 */
import { readFileSync } from 'node:fs';
import type { StatusLineInput } from '../types.js';
import { basename } from './format.js';

export function readInput(): StatusLineInput {
  let raw = '';
  try {
    // fd 0 read synchronously: the process is short-lived and Claude Code
    // cancels it if a new update arrives, so there is nothing to await.
    raw = readFileSync(0, 'utf8');
  } catch {
    return {};
  }

  if (!raw.trim()) return {};

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as StatusLineInput;
    }
  } catch {
    // Not JSON: treat it as no data.
  }
  return {};
}

/** Wraps a style so no failure can leave the status line blank. */
export function run(render: (input: StatusLineInput) => void): void {
  const input = readInput();
  try {
    render(input);
  } catch (error) {
    const dir = basename(input.workspace?.current_dir ?? input.cwd);
    const reason = error instanceof Error ? error.message : String(error);
    process.stdout.write(`${dir} [statusline error: ${reason}]\n`);
  }
}
