import {
  findReservedPathParameter,
  ReservedPathParameterError,
} from "./ReservedPathParameter.js";
import type { ResponseDefinition } from "./defineResponse.js";
import type { HttpMethod } from "./HttpMethod.js";
import type { HttpRequestBoundaryConstraint } from "./HttpRequestBoundary.js";
import type { RequestDefinition } from "./RequestDefinition.js";
import type { SecurityRequirements } from "./SecurityDefinition.js";

type LowercaseLetter =
  | "a"
  | "b"
  | "c"
  | "d"
  | "e"
  | "f"
  | "g"
  | "h"
  | "i"
  | "j"
  | "k"
  | "l"
  | "m"
  | "n"
  | "o"
  | "p"
  | "q"
  | "r"
  | "s"
  | "t"
  | "u"
  | "v"
  | "w"
  | "x"
  | "y"
  | "z";

/** Characters admitted by the canonical `[A-Za-z0-9_]+` placeholder grammar. */
type PlaceholderNameChar =
  | LowercaseLetter
  | Uppercase<LowercaseLetter>
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "_";

/**
 * Consumes a canonical placeholder name starting at the current position.
 * Returns the consumed name and the unconsumed remainder; the name ends at the
 * first character outside the `[A-Za-z0-9_]+` class.
 */
type ConsumePlaceholderName<
  TPath extends string,
  TName extends string = "",
> = TPath extends `${infer TChar}${infer TRest}`
  ? TChar extends PlaceholderNameChar
    ? ConsumePlaceholderName<TRest, `${TName}${TChar}`>
    : { readonly name: TName; readonly rest: TPath }
  : { readonly name: TName; readonly rest: "" };

/** Returns the path after the first `:`, or `undefined` when none remains. */
type AfterFirstColon<TPath extends string> =
  TPath extends `${infer TChar}${infer TRest}`
    ? TChar extends ":"
      ? TRest
      : AfterFirstColon<TRest>
    : undefined;

/**
 * Compile-time rejection of a `:__proto__` route placeholder, modelled on the
 * canonical `:([A-Za-z0-9_]+)` grammar. The placeholder name is consumed
 * exactly, so `:__proto__`, `:__proto__.:format`, `:__proto__-suffix`,
 * `:__proto__{suffix}`, and later occurrences are rejected regardless of the
 * non-name terminator, while `:__proto__x` and other prefixes are preserved.
 */
type HasReservedPathParameter<TPath extends string> =
  AfterFirstColon<TPath> extends infer TAfterColon
    ? TAfterColon extends string
      ? ConsumePlaceholderName<TAfterColon> extends {
          readonly name: infer TName extends string;
          readonly rest: infer TRest extends string;
        }
        ? TName extends "__proto__"
          ? true
          : HasReservedPathParameter<TRest>
        : false
      : false
    : false;

export type ReservedPathParameterConstraint<TPath extends string> =
  HasReservedPathParameter<TPath> extends true
    ? {
        readonly __typeweaverReservedPathParameterError__: "Path parameter ':__proto__' is reserved";
      }
    : unknown;

export type OperationDefinition<
  TOperationId extends string = string,
  TPath extends string = string,
  TMethod extends HttpMethod = HttpMethod,
  TSummary extends string = string,
  TRequest extends RequestDefinition = RequestDefinition,
  TResponses extends readonly ResponseDefinition[] =
    readonly ResponseDefinition[],
  TDescription extends string | undefined = string | undefined,
  TDeprecated extends boolean | undefined = boolean | undefined,
  TTags extends readonly string[] | undefined = readonly string[] | undefined,
  TSecurity extends SecurityRequirements | undefined =
    | SecurityRequirements
    | undefined,
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
  readonly description?: TDescription;
  readonly deprecated?: TDeprecated;
  readonly tags?: TTags;
  readonly security?: TSecurity;
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
export const defineOperation = <const TDefinition extends OperationDefinition>(
  definition: TDefinition &
    HttpRequestBoundaryConstraint<TDefinition["request"]> &
    ReservedPathParameterConstraint<TDefinition["path"]>
): TDefinition => {
  const reservedPathParameter = findReservedPathParameter(definition.path);

  if (reservedPathParameter !== undefined) {
    throw new ReservedPathParameterError(
      definition.path,
      reservedPathParameter
    );
  }

  return definition;
};
