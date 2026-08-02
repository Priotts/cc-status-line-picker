/**
 * fancy/powerline — two rows of filled segments joined by powerline arrows.
 *
 *    ◆ Opus 5 ▶ my-project ▶ ⎇ main ▶ $66.05 ◴ 3h06m ▶
 *    ctx 46% ▶ 5h 78% → 91%  02:00 ▶ 7d 37% → 52%  Wed 13:00 ▶
 *
 * REQUIRES A NERD FONT (or any patched font providing U+E0B0 and U+E0B1).
 * Without one the separators render as missing-glyph boxes. Every other style
 * is plain Unicode.
 *
 * Split across two rows because a single row carrying all of this ran past 100
 * columns, and a powerline row truncated mid-segment leaves a ragged block of
 * colour that reads as broken rather than as clipped. Two rows of roughly 55
 * survive a split terminal.
 *
 * The top row answers "which session is this, and what has it cost"; the bottom
 * row is the gauges. Within a gauge the text carries its own hierarchy —
 * dim label, bright current value, tinted projection, dim clock — so three
 * numbers in one segment stay legible without extra width.
 *
 * The palette is deliberately local: the semantic colors in config.json are
 * chosen as foregrounds and read badly as segment backgrounds.
 */
import { run } from '../lib/input.js';
import { loadConfig } from '../lib/config.js';
import { fg, colorEnabled } from '../lib/ansi.js';
import { getGitInfo } from '../lib/git.js';
import { basename, duration, money, pct, printLines, resetsAtClock } from '../lib/format.js';
import { projectedUsage, WINDOW_SECONDS, type WindowLabel } from '../lib/segments.js';
import type { RateLimitWindow } from '../types.js';

/**
 * The two powerline separators, built from char codes because they live in the
 * Unicode Private Use Area and are invisible in most editors.
 *
 * U+E0B0 is the solid triangle, drawn in the previous segment's background over
 * the next one's. U+E0B1 is the thin chevron, used where two neighbours share a
 * background: there the solid form would be the same colour as what it sits on
 * and would simply vanish, merging both segments into one block.
 */
const SEP = String.fromCharCode(0xe0b0);
const THIN_SEP = String.fromCharCode(0xe0b1);

const PALETTE = {
  modelBg: '238',
  modelFg: '252',
  dirBg: '31',
  dirFg: '231',
  /** Trunk: quiet. A feature branch gets the violet below so it stands out. */
  trunkBg: '236',
  trunkFg: '250',
  featureBg: '54',
  featureFg: '225',
  costBg: '24',
  costFg: '231',
  gaugeOkBg: '28',
  gaugeWarnBg: '136',
  gaugeDangerBg: '124',
  /** Within a gauge: the value, its label and clock, and the projection. */
  value: '231',
  label: '250',
  paceOver: '210',
  paceUnder: '194',
};

/** A run of text inside a segment. Only the foreground varies. */
interface Part {
  text: string;
  fg: string;
}

interface Segment {
  parts: Part[];
  bg: string;
}

function simple(text: string, fgColor: string, bg: string): Segment {
  return { parts: [{ text, fg: fgColor }], bg };
}

/** Background for a percentage gauge, on the same scale the other styles use. */
function gaugeBg(percentage: number): string {
  const { thresholds } = loadConfig();
  if (percentage >= thresholds.danger) return PALETTE.gaugeDangerBg;
  if (percentage >= thresholds.warn) return PALETTE.gaugeWarnBg;
  return PALETTE.gaugeOkBg;
}

const CSI = '[';

function render(segments: Segment[]): string {
  // This style paints its own escape sequences rather than going through the
  // ansi.js helpers, so it has to honour NO_COLOR itself. With colour off the
  // ribbon means nothing and the separators would be tofu in an unpatched
  // font, so the segments degrade to plain text.
  if (!colorEnabled) {
    return segments
      .map((seg) => seg.parts.map((part) => part.text).join(''))
      .join(loadConfig().separator);
  }

  let out = '';

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;

    // One background for the whole segment; the foreground changes per part.
    // Padding rides on the first and last part so the arrows sit flush.
    const body = seg.parts
      .map((part, index) => {
        const lead = index === 0 ? ' ' : '';
        const trail = index === seg.parts.length - 1 ? ' ' : '';
        return `${CSI}38;5;${part.fg};48;5;${seg.bg}m${lead}${part.text}${trail}`;
      })
      .join('');
    out += `${body}${CSI}0m`;

    const next = segments[i + 1];
    if (!next) {
      out += fg(seg.bg, SEP);
    } else if (next.bg === seg.bg) {
      out += `${CSI}38;5;${seg.parts[0]?.fg ?? PALETTE.value};48;5;${seg.bg}m${THIN_SEP}${CSI}0m`;
    } else {
      out += `${CSI}38;5;${seg.bg};48;5;${next.bg}m${SEP}${CSI}0m`;
    }
  }

  return out;
}

function gauge(label: WindowLabel | 'ctx', window: RateLimitWindow | null | undefined): Segment | null {
  if (typeof window?.used_percentage !== 'number') return null;

  const cfg = loadConfig();
  const used = pct(window.used_percentage);
  const parts: Part[] = [
    { text: `${label} `, fg: PALETTE.label },
    { text: `${Math.round(used)}%`, fg: PALETTE.value },
  ];

  if (label !== 'ctx') {
    const projected = projectedUsage(used, window.resets_at, WINDOW_SECONDS[label]);
    if (projected !== null) {
      parts.push({
        text: ` → ${Math.round(projected)}%`,
        fg: projected > 100 ? PALETTE.paceOver : PALETTE.paceUnder,
      });
    }
  }

  if (cfg.showResetTime) {
    const clock = resetsAtClock(window.resets_at);
    if (clock) parts.push({ text: `  ${clock}`, fg: PALETTE.label });
  }

  return { parts, bg: gaugeBg(used) };
}

run((input) => {
  const cfg = loadConfig();
  const cwd = input.workspace?.current_dir ?? input.cwd ?? null;

  // Row 1 — which session is this, and what has it cost.
  const top: Segment[] = [];

  if (cfg.showModel && input.model?.display_name) {
    const fast = input.fast_mode ? ` ${cfg.icons.fast}` : '';
    top.push(
      simple(`${cfg.icons.model} ${input.model.display_name}${fast}`, PALETTE.modelFg, PALETTE.modelBg),
    );
  }

  top.push(simple(basename(cwd), PALETTE.dirFg, PALETTE.dirBg));

  const git = cfg.showGit ? getGitInfo(cwd) : null;
  if (git) {
    const onTrunk = cfg.defaultBranches.includes(git.branch);
    top.push(
      simple(
        `${cfg.icons.branch} ${git.branch}${git.clean ? '' : '*'}`,
        onTrunk ? PALETTE.trunkFg : PALETTE.featureFg,
        onTrunk ? PALETTE.trunkBg : PALETTE.featureBg,
      ),
    );
  }

  if (cfg.showCost && typeof input.cost?.total_cost_usd === 'number') {
    // Spend and elapsed time answer the same question — what has this run cost
    // me — so they share a segment rather than paying for a second separator.
    const elapsed = input.cost.total_duration_ms
      ? ` ${cfg.icons.clock} ${duration(input.cost.total_duration_ms)}`
      : '';
    top.push(simple(`${money(input.cost.total_cost_usd)}${elapsed}`, PALETTE.costFg, PALETTE.costBg));
  }

  // Row 2 — the gauges, all on one scale so they compare directly.
  // `gauge` returns null for a window the payload doesn't carry; the row simply
  // gets shorter rather than showing a zero.
  const bottom = [
    gauge('ctx', { used_percentage: input.context_window?.used_percentage }),
    cfg.showLimits ? gauge('5h', input.rate_limits?.five_hour) : null,
    cfg.showLimits ? gauge('7d', input.rate_limits?.seven_day) : null,
  ].filter((s): s is Segment => s !== null);

  const rows = [top, bottom].filter((row) => row.length > 0).map(render);

  printLines(rows);
});
