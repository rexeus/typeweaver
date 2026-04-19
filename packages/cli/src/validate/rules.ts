import type { Issue, IssueSeverity, ValidateConfig } from "./types.js";

export type RuleMetadata = {
  readonly code: string;
  readonly label: string;
  readonly defaultSeverity: IssueSeverity;
  readonly enabledByDefault: boolean;
};

const makeRule = (
  code: string,
  label: string,
  defaultSeverity: IssueSeverity,
  enabledByDefault = true
): RuleMetadata => {
  return { code, label, defaultSeverity, enabledByDefault };
};

/**
 * Canonical rule registry. Every issue emitted by a core check MUST reference
 * a code listed here. Plugin-emitted issues are allowed to use codes outside
 * this registry — the resolver treats them as "enabled by default, severity
 * as reported".
 */
export const CORE_RULES: readonly RuleMetadata[] = [
  // Spec integrity — emitted by the loadSpec check. Each maps to a normalize
  // error class, giving CI and LSP integrations stable codes.
  makeRule("TW-SPEC-001", "spec/load-failure", "error"),
  makeRule("TW-SPEC-002", "spec/duplicate-operation-id", "error"),
  makeRule("TW-SPEC-003", "spec/duplicate-route", "error"),
  makeRule("TW-SPEC-004", "spec/empty-spec", "error"),
  makeRule("TW-SPEC-005", "spec/empty-resource-operations", "error"),
  makeRule("TW-SPEC-006", "spec/empty-operation-responses", "error"),
  makeRule("TW-SPEC-007", "spec/invalid-operation-id", "error"),
  makeRule("TW-SPEC-008", "spec/invalid-resource-name", "error"),
  makeRule("TW-SPEC-009", "spec/invalid-request-schema", "error"),
  makeRule("TW-SPEC-010", "spec/path-parameter-mismatch", "error"),
  makeRule("TW-SPEC-011", "spec/invalid-derived-response", "error"),
  makeRule("TW-SPEC-012", "spec/missing-derived-response-parent", "error"),
  makeRule("TW-SPEC-013", "spec/derived-response-cycle", "error"),

  // Style — opt-in conventions, off by default to keep the baseline honest.
  makeRule("TW-STYLE-001", "style/operation-id-camel-case", "warning", false),
  makeRule("TW-STYLE-002", "style/path-kebab-case", "warning", false),

  // Plugin infrastructure.
  makeRule("TW-PLUGIN-CRASH-001", "plugin/validator-crash", "error"),
];

const CORE_RULES_BY_CODE = new Map(
  CORE_RULES.map(rule => [rule.code, rule] as const)
);

export type RuleResolverConfig = {
  readonly strict: boolean;
  readonly failOn: IssueSeverity;
  readonly disable: readonly string[];
  readonly enable: readonly string[];
};

export type RuleResolver = {
  readonly isEnabled: (code: string) => boolean;
  readonly resolveSeverity: (issue: Issue) => IssueSeverity;
  readonly isFailing: (severity: IssueSeverity) => boolean;
  readonly rules: readonly RuleMetadata[];
};

const SEVERITY_RANK = {
  info: 0,
  warning: 1,
  error: 2,
} as const satisfies Record<IssueSeverity, number>;

const rankOf = (severity: IssueSeverity): number => {
  return SEVERITY_RANK[severity];
};

export const createRuleResolver = (
  config: RuleResolverConfig,
  rules: readonly RuleMetadata[] = CORE_RULES
): RuleResolver => {
  const rulesByCode = new Map(rules.map(rule => [rule.code, rule] as const));
  const disabled = new Set(config.disable);
  const enabled = new Set(config.enable);

  const isEnabled = (code: string): boolean => {
    if (disabled.has(code)) {
      return false;
    }

    if (enabled.has(code)) {
      return true;
    }

    const rule = rulesByCode.get(code);
    // Unknown codes (e.g. plugin-emitted) default to enabled unless explicitly
    // disabled. This keeps the barrier for plugin authors low.
    return rule?.enabledByDefault ?? true;
  };

  const resolveSeverity = (issue: Issue): IssueSeverity => {
    if (!config.strict) {
      return issue.severity;
    }

    return issue.severity === "warning" ? "error" : issue.severity;
  };

  const failThreshold = SEVERITY_RANK[config.failOn];

  const isFailing = (severity: IssueSeverity): boolean => {
    return rankOf(severity) >= failThreshold;
  };

  return {
    isEnabled,
    resolveSeverity,
    isFailing,
    rules,
  };
};

export const resolveValidateOptions = (
  overrides: ValidateConfig | undefined,
  defaults: ValidateConfig = {}
): RuleResolverConfig => {
  return {
    strict: overrides?.strict ?? defaults.strict ?? false,
    failOn: overrides?.failOn ?? defaults.failOn ?? "error",
    disable: overrides?.disable ?? defaults.disable ?? [],
    enable: overrides?.enable ?? defaults.enable ?? [],
  };
};

export const getCoreRule = (code: string): RuleMetadata | undefined => {
  return CORE_RULES_BY_CODE.get(code);
};

/**
 * Apply a rule resolver to a raw issue stream: drops disabled codes and
 * rewrites the severity according to `--strict` and the rule's declared
 * default. Produces the issue list that appears in the final report.
 */
export const applyIssueRules = (
  issues: readonly Issue[],
  ruleResolver: RuleResolver
): readonly Issue[] => {
  return issues
    .filter(issue => ruleResolver.isEnabled(issue.code))
    .map(issue => ({
      ...issue,
      severity: ruleResolver.resolveSeverity(issue),
    }));
};
