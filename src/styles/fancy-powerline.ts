/**
 * fancy/powerline — one line of filled segments joined by powerline arrows.
 *
 *   ◆ Opus  my-project  main*  38%
 *
 * REQUIRES A NERD FONT (or any patched font providing U+E0B0). Without one the
 * separators render as a missing-glyph box. Every other style is plain Unicode.
 *
 * The palette is deliberately local: the semantic colors in config.json are
 * chosen as foregrounds and read badly as segment backgrounds.
 */
import { run } from '../lib/input.js';
import { loadConfig } from '../lib/config.js';
import { fg, fgBg } from '../lib/ansi.js';
import { getGitInfo } from '../lib/git.js';
import { basename, pct, printLines } from '../lib/format.js';

/** U+E0B0, the solid right-pointing triangle. */
const SEP = '';

const PALETTE = {
  modelBg: '238',
  modelFg: '252',
  dirBg: '31',
  dirFg: '231',
  gitBg: '236',
  gitFg: '250',
  ctxOkBg: '28',
  ctxWarnBg: '136',
  ctxDangerBg: '124',
  ctxFg: '231',
};

interface Segment {
  text: string;
  fg: string;
  bg: string;
}

function render(segments: Segment[]): string {
  let out = '';
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;
    out += fgBg(seg.fg, seg.bg, ` ${seg.text} `);
    const next = segments[i + 1];
    // The arrow is drawn in this segment's background over the next one's,
    // which is what makes the segments read as a continuous ribbon.
    out += next ? fgBg(seg.bg, next.bg, SEP) : fg(seg.bg, SEP);
  }
  return out;
}

run((input) => {
  const cfg = loadConfig();
  const cwd = input.workspace?.current_dir ?? input.cwd ?? null;
  const segments: Segment[] = [];

  if (cfg.showModel && input.model?.display_name) {
    segments.push({
      text: `${cfg.icons.model} ${input.model.display_name}`,
      fg: PALETTE.modelFg,
      bg: PALETTE.modelBg,
    });
  }

  segments.push({ text: basename(cwd), fg: PALETTE.dirFg, bg: PALETTE.dirBg });

  const git = cfg.showGit ? getGitInfo(cwd) : null;
  if (git) {
    segments.push({
      text: `${cfg.icons.branch} ${git.branch}${git.clean ? '' : '*'}`,
      fg: PALETTE.gitFg,
      bg: PALETTE.gitBg,
    });
  }

  const ctx = pct(input.context_window?.used_percentage);
  const ctxBg =
    ctx >= cfg.thresholds.danger
      ? PALETTE.ctxDangerBg
      : ctx >= cfg.thresholds.warn
        ? PALETTE.ctxWarnBg
        : PALETTE.ctxOkBg;
  segments.push({ text: `${Math.round(ctx)}%`, fg: PALETTE.ctxFg, bg: ctxBg });

  printLines([render(segments)]);
});
