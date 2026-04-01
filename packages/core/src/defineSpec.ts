import { validateUniqueResponseNames } from "./validateResponseUniqueness";
import type { OperationDefinition } from "./defineOperation";

export type ResourceDefinition<
  TOperations extends readonly OperationDefinition[] =
    readonly OperationDefinition[],
> = {
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
> = {
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
 *   resources: {
 *     todo: { operations: [GetTodo, CreateTodo, DeleteTodo] as const },
 *     auth: { operations: [AccessToken, RefreshToken] as const },
 *   },
 * });
 * ```
 */
export const defineSpec = <
  TResources extends Record<string, ResourceDefinition>,
>(
  definition: SpecDefinition<TResources>
): SpecDefinition<TResources> => {
  validateUniqueResponseNames(definition.resources);

  return definition;
};
