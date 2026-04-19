/**
 * Severity of a validation issue.
 *
 * - `error`   : the spec is invalid and cannot be used for generation.
 * - `warning` : the spec compiles but violates a recommended practice.
 * - `info`    : purely informational, e.g. deprecation notices.
 */
export type IssueSeverity = "error" | "warning" | "info";

/**
 * A structured validation finding.
 *
 * Issue codes follow the scheme `TW-<DOMAIN>-<NNN>` so they remain stable for
 * LSP integrations, CI tooling, and user-facing documentation.
 *
 * Examples:
 *   - `TW-SPEC-001` — spec failed to load/normalize
 *   - `TW-STYLE-001` — operation ID style violation
 *   - `TW-PLUGIN-HONO-003` — hono plugin specific rule
 */
export type Issue = {
  readonly code: string;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly path?: string;
  readonly hint?: string;
  readonly fixable?: boolean;
};
