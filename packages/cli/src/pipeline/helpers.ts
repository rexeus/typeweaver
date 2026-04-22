import type { BaseCheckResult, CheckOutcome } from "./types.js";

export type ResultTemplate<TResult extends BaseCheckResult> = Omit<
  TResult,
  "status" | "summary" | "details"
>;

export type OutcomeOptions<TState> = {
  readonly details?: readonly string[];
  readonly state?: Partial<TState>;
};

export const pass = <TState extends object, TResult extends BaseCheckResult>(
  template: ResultTemplate<TResult>,
  summary: string,
  options: OutcomeOptions<TState> = {}
): CheckOutcome<TState, TResult> => {
  return buildOutcome(template, "pass", summary, options);
};

export const warn = <TState extends object, TResult extends BaseCheckResult>(
  template: ResultTemplate<TResult>,
  summary: string,
  options: OutcomeOptions<TState> = {}
): CheckOutcome<TState, TResult> => {
  return buildOutcome(template, "warn", summary, options);
};

export const fail = <TState extends object, TResult extends BaseCheckResult>(
  template: ResultTemplate<TResult>,
  summary: string,
  options: OutcomeOptions<TState> = {}
): CheckOutcome<TState, TResult> => {
  return buildOutcome(template, "fail", summary, options);
};

const buildOutcome = <TState extends object, TResult extends BaseCheckResult>(
  template: ResultTemplate<TResult>,
  status: BaseCheckResult["status"],
  summary: string,
  options: OutcomeOptions<TState>
): CheckOutcome<TState, TResult> => {
  const result = {
    ...template,
    status,
    summary,
    details: options.details ?? [],
  } as unknown as TResult;

  if (options.state !== undefined) {
    return { result, state: options.state };
  }

  return { result };
};
