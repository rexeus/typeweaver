import type { ResponseDefinition } from "./defineResponse";
import type { HttpMethod } from "./HttpMethod";
import type { RequestDefinition } from "./RequestDefinition";

export type OperationDefinition<
  TOperationId extends string = string,
  TPath extends string = string,
  TMethod extends HttpMethod = HttpMethod,
  TSummary extends string = string,
  TRequest extends RequestDefinition = RequestDefinition,
  TResponses extends readonly ResponseDefinition[] =
    readonly ResponseDefinition[],
> = {
  readonly operationId: TOperationId;
  readonly path: TPath;
  readonly method: TMethod;
  readonly summary: TSummary;
  readonly request: TRequest;
  readonly responses: TResponses;
};

export const defineOperation = <
  TOperationId extends string,
  TPath extends string,
  TMethod extends HttpMethod,
  TSummary extends string,
  TRequest extends RequestDefinition,
  TResponses extends readonly ResponseDefinition[],
>(
  definition: OperationDefinition<
    TOperationId,
    TPath,
    TMethod,
    TSummary,
    TRequest,
    TResponses
  >
): OperationDefinition<
  TOperationId,
  TPath,
  TMethod,
  TSummary,
  TRequest,
  TResponses
> => {
  return definition;
};
