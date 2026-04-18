import {
  fail as baseFail,
  pass as basePass,
  warn as baseWarn,
} from "../../pipeline/helpers.js";
import type { OutcomeOptions, ResultTemplate } from "../../pipeline/helpers.js";
import type {
  Issue,
  IssueSeverity,
  ValidateCheckOutcome,
  ValidateCheckResult,
  ValidateCheckContext,
  ValidateState,
} from "../types.js";

type CheckTemplate = ResultTemplate<ValidateCheckResult>;

export type CheckIdentityInfo = {
  readonly id: string;
  readonly label: string;
};

/**
 * Pre-binds a check's identity to the outcome helpers. Each check defines
 * its `{ id, label }` once and uses the returned helpers inside `run`, which
 * eliminates the identity-duplication that would otherwise appear at every
 * `pass`/`warn`/`fail`/`finalize` call-site.
 */
export type CheckHelpers = {
  readonly pass: (
    summary: string,
    options?: OutcomeOptions<ValidateState>
  ) => ValidateCheckOutcome;
  readonly warn: (
    summary: string,
    options?: OutcomeOptions<ValidateState>
  ) => ValidateCheckOutcome;
  readonly fail: (
    summary: string,
    options?: OutcomeOptions<ValidateState>
  ) => ValidateCheckOutcome;
  readonly finalize: (
    issues: readonly Issue[],
    resolver: { readonly resolveSeverity: (issue: Issue) => IssueSeverity },
    messages: FinalizeMessages,
    state?: Partial<ValidateState>
  ) => ValidateCheckOutcome;
};

export const createCheckHelpers = (
  identity: CheckIdentityInfo
): CheckHelpers => {
  return {
    pass: (summary, options) => pass(identity, summary, options),
    warn: (summary, options) => warn(identity, summary, options),
    fail: (summary, options) => fail(identity, summary, options),
    finalize: (issues, resolver, messages, state) =>
      finalize(identity, issues, resolver, messages, state),
  };
};

export const pass = (
  template: CheckTemplate,
  summary: string,
  options: OutcomeOptions<ValidateState> = {}
): ValidateCheckOutcome => {
  return basePass<ValidateState, ValidateCheckResult>(
    template,
    summary,
    options
  );
};

export const warn = (
  template: CheckTemplate,
  summary: string,
  options: OutcomeOptions<ValidateState> = {}
): ValidateCheckOutcome => {
  return baseWarn<ValidateState, ValidateCheckResult>(
    template,
    summary,
    options
  );
};

export const fail = (
  template: CheckTemplate,
  summary: string,
  options: OutcomeOptions<ValidateState> = {}
): ValidateCheckOutcome => {
  return baseFail<ValidateState, ValidateCheckResult>(
    template,
    summary,
    options
  );
};

export const emit = (context: ValidateCheckContext, issue: Issue): void => {
  context.emitIssue(issue);
};

/**
 * Finalize a check based on the issues it emitted.
 *
 * - any error-severity issue → `fail`
 * - only warning-severity issues → `warn`
 * - only info-severity issues → `pass` with the optional `info` message
 * - no issues → `pass` with the default `pass` message
 *
 * The `messages` strategy lets the caller specify what each terminal state
 * says to the user without repeating the branching logic here.
 */
export type FinalizeMessages = {
  readonly pass: string;
  readonly warn: (count: number) => string;
  readonly fail: (count: number) => string;
  readonly info?: (count: number) => string;
};

type SeverityCounts = {
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
};

const countSeverities = (
  issues: readonly Issue[],
  resolver: { readonly resolveSeverity: (issue: Issue) => IssueSeverity }
): SeverityCounts => {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const issue of issues) {
    const severity = resolver.resolveSeverity(issue);
    if (severity === "error") errors += 1;
    else if (severity === "warning") warnings += 1;
    else infos += 1;
  }

  return { errors, warnings, infos };
};

export const finalize = (
  template: CheckTemplate,
  issues: readonly Issue[],
  resolver: { readonly resolveSeverity: (issue: Issue) => IssueSeverity },
  messages: FinalizeMessages,
  state?: Partial<ValidateState>
): ValidateCheckOutcome => {
  const { errors, warnings, infos } = countSeverities(issues, resolver);

  if (errors > 0) {
    return fail(template, messages.fail(errors), { state });
  }

  if (warnings > 0) {
    return warn(template, messages.warn(warnings), { state });
  }

  if (infos > 0 && messages.info) {
    return pass(template, messages.info(infos), { state });
  }

  return pass(template, messages.pass, { state });
};
