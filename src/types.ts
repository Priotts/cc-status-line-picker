/**
 * Schema of the JSON Claude Code sends on stdin to the `statusLine` command.
 * Mirrors https://code.claude.com/docs/en/statusline#available-data
 *
 * Almost everything is optional on purpose: many fields are absent or `null`
 * before the first API response, and others only appear in specific contexts
 * (worktree, open PR, vim mode, agent). Never assume a field is present.
 */

export type EffortLevel = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
export type VimMode = 'NORMAL' | 'INSERT' | 'VISUAL' | 'VISUAL LINE';
export type ReviewState = 'approved' | 'pending' | 'changes_requested' | 'draft';

export interface ModelInfo {
  id?: string | null;
  display_name?: string | null;
}

export interface RepoInfo {
  host?: string | null;
  owner?: string | null;
  name?: string | null;
}

export interface WorkspaceInfo {
  current_dir?: string | null;
  project_dir?: string | null;
  added_dirs?: string[] | null;
  /** Worktree name when the cwd is inside a linked worktree. Absent in the main tree. */
  git_worktree?: string | null;
  repo?: RepoInfo | null;
}

export interface CostInfo {
  total_cost_usd?: number | null;
  total_duration_ms?: number | null;
  total_api_duration_ms?: number | null;
  total_lines_added?: number | null;
  total_lines_removed?: number | null;
}

export interface CurrentUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface ContextWindowInfo {
  total_input_tokens?: number | null;
  total_output_tokens?: number | null;
  /** 200000 by default, 1000000 for extended-context models. */
  context_window_size?: number | null;
  used_percentage?: number | null;
  remaining_percentage?: number | null;
  current_usage?: CurrentUsage | null;
}

export interface RateLimitWindow {
  used_percentage?: number | null;
  /** Unix epoch seconds. */
  resets_at?: number | null;
}

export interface RateLimits {
  five_hour?: RateLimitWindow | null;
  seven_day?: RateLimitWindow | null;
}

export interface PullRequestInfo {
  number?: number | null;
  url?: string | null;
  review_state?: ReviewState | null;
}

export interface WorktreeInfo {
  name?: string | null;
  path?: string | null;
  branch?: string | null;
  original_cwd?: string | null;
  original_branch?: string | null;
}

export interface StatusLineInput {
  cwd?: string | null;
  session_id?: string | null;
  session_name?: string | null;
  prompt_id?: string | null;
  transcript_path?: string | null;
  version?: string | null;
  model?: ModelInfo | null;
  workspace?: WorkspaceInfo | null;
  output_style?: { name?: string | null } | null;
  cost?: CostInfo | null;
  context_window?: ContextWindowInfo | null;
  /** Fixed 200k threshold, independent of the actual context window size. */
  exceeds_200k_tokens?: boolean | null;
  fast_mode?: boolean | null;
  effort?: { level?: EffortLevel | null } | null;
  thinking?: { enabled?: boolean | null } | null;
  rate_limits?: RateLimits | null;
  vim?: { mode?: VimMode | null } | null;
  agent?: { name?: string | null } | null;
  pr?: PullRequestInfo | null;
  worktree?: WorktreeInfo | null;
}
