import { validateUniqueResponseNames } from "./validateResponseUniqueness.js";
import type { ApiMetadataDefinition } from "./ApiMetadata.js";
import type { OperationDefinition } from "./defineOperation.js";
import type {
  SecurityRequirements,
  SecuritySchemeDefinition,
} from "./SecurityDefinition.js";

export type ResourceDefinition<
  TOperations extends readonly OperationDefinition[] =
    readonly OperationDefinition[],
> = {
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly security?: SecurityRequirements;
  /**
   * Tuple of operations belonging to this resource. Order determines
   * the sequence in generated route registrations
   */
  readonly operations: TOperations;
};

export type SpecDefinition<
  TResources extends Record<string, ResourceDefinition> = Record<
    string,
    ResourceDefinition
  >,
  TMetadata extends ApiMetadataDefinition = ApiMetadataDefinition,
  TSecuritySchemes extends readonly SecuritySchemeDefinition[] | undefined =
    | readonly SecuritySchemeDefinition[]
    | undefined,
  TSecurity extends SecurityRequirements | undefined =
    | SecurityRequirements
    | undefined,
> = {
  readonly metadata: TMetadata;
  readonly securitySchemes?: TSecuritySchemes;
  readonly security?: TSecurity;
  /**
   * Each key becomes the resource directory name in generated output.
   * Prefer singular camelCase names (for example `"user"`, `"authSession"`).
   * PascalCase and plural names are supported for compatibility, but
   * snake_case and kebab-case are not supported.
   */
  readonly resources: TResources;
};

/**
 * Declares a Typeweaver spec with compile-time type inference and runtime
 * validation for globally unique response names.
 *
 * @param definition - The complete resource map for your API
 * @returns The spec definition with its inferred literal types preserved
 *
 * @example
 * ```ts
 * export const spec = defineSpec({
 *   metadata: { title: "Todo API", version: "1.0.0" },
 *   resources: {
 *     todo: { operations: [GetTodo, CreateTodo, DeleteTodo] as const },
 *     auth: { operations: [AccessToken, RefreshToken] as const },
 *   },
 * });
 * ```
 */
export const defineSpec = <const TDefinition extends SpecDefinition>(
  definition: TDefinition
): TDefinition => {
  validateUniqueResponseNames(definition.resources);

  return definition;
};
