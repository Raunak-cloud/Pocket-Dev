/**
 * Shared types used by prompt builders.
 */

export interface LintIssue {
  path: string;
  line: number;
  column: number;
  rule: string | null;
  message: string;
}
