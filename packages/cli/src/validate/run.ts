import type { Logger } from "../logger.js";
import type { RuleResolver } from "./rules.js";
import type { ValidateCheckContext, ValidateState } from "./types.js";

export type ValidationRunParams = {
  readonly initialState?: Partial<ValidateState>;
  readonly logger: Logger;
  readonly execDir: string;
  readonly temporaryDirectory: string;
  readonly ruleResolver: RuleResolver;
  readonly pluginsEnabled: boolean;
};

export type ValidationRun = {
  readonly state: ValidateState;
  readonly context: ValidateCheckContext;
};

export const createValidationRun = (
  params: ValidationRunParams
): ValidationRun => {
  const state: ValidateState = {
    ...params.initialState,
    collectedIssues: [],
  };

  const context: ValidateCheckContext = {
    state,
    logger: params.logger,
    execDir: params.execDir,
    temporaryDirectory: params.temporaryDirectory,
    ruleResolver: params.ruleResolver,
    pluginsEnabled: params.pluginsEnabled,
    emitIssue: issue => {
      state.collectedIssues.push(issue);
    },
  };

  return { state, context };
};
