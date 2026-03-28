import type { OperationDefinition } from "./defineOperation";
import type { ResponseDefinition } from "./defineResponse";

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
   * Keys should be lowercase, typically matching the domain entity
   * (e.g. `"todo"`, `"auth"`)
   */
  readonly resources: TResources;
};

export class DuplicateResponseNameError extends Error {
  public constructor(responseName: string) {
    super(
      `Response name '${responseName}' must be globally unique within a spec.`
    );
    this.name = "DuplicateResponseNameError";
  }
}

const assertUniqueResponseNames = (
  resources: Record<string, ResourceDefinition>
): void => {
  const responsesByName = new Map<string, ResponseDefinition>();

  for (const resource of Object.values(resources)) {
    for (const operation of resource.operations) {
      for (const response of operation.responses) {
        const existingResponse = responsesByName.get(response.name);

        if (existingResponse !== undefined && existingResponse !== response) {
          throw new DuplicateResponseNameError(response.name);
        }

        responsesByName.set(response.name, response);
      }
    }
  }
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
  assertUniqueResponseNames(definition.resources);

  return definition;
};
