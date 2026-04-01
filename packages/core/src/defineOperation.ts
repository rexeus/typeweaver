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
  /**
   * Must be globally unique within a spec. Used as the base name for
   * generated clients, validators, and route handlers. Prefer camelCase
   * (for example `getUser`). PascalCase is supported for compatibility,
   * but snake_case and kebab-case are not supported.
   */
  readonly operationId: TOperationId;
  /**
   * Express-style path with `:param` placeholders (e.g. `/todos/:todoId`).
   * Parameters must match the keys in `request.param`
   */
  readonly path: TPath;
  /**
   * One of the standard HTTP methods from the `HttpMethod` enum
   */
  readonly method: TMethod;
  /**
   * Appears in generated OpenAPI descriptions and code comments
   */
  readonly summary: TSummary;
  /**
   * Zod schemas defining the shape of incoming data. All parts (header,
   * param, query, body) are optional; omit a key to indicate no constraint
   */
  readonly request: TRequest;
  /**
   * First response is treated as the primary success case. Use `defineResponse`
   * for shared responses and inline objects for operation-specific ones
   */
  readonly responses: TResponses;
};

/**
 * Declares a single API operation while preserving literal types for code
 * generation and validation.
 *
 * @param definition - The operation definition to register in a spec
 * @returns The same operation definition with its inferred types preserved
 *
 * @example
 * ```ts
 * const GetTodo = defineOperation({
 *   operationId: "getTodo",
 *   path: "/todos/:todoId",
 *   method: HttpMethod.GET,
 *   summary: "Retrieve a single todo by ID",
 *   request: {
 *     param: z.object({ todoId: z.string().uuid() }),
 *   },
 *   responses: [GetTodoSuccess, NotFoundError] as const,
 * });
 * ```
 */
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
