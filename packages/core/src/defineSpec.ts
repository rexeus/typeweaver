import type { OperationDefinition } from "./defineOperation";
import type { ResponseDefinition } from "./defineResponse";

export type ResourceDefinition<
  TOperations extends readonly OperationDefinition[] =
    readonly OperationDefinition[],
> = {
  readonly operations: TOperations;
};

export type SpecDefinition<
  TResources extends Record<string, ResourceDefinition> = Record<
    string,
    ResourceDefinition
  >,
> = {
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

export const defineSpec = <
  TResources extends Record<string, ResourceDefinition>,
>(
  definition: SpecDefinition<TResources>
): SpecDefinition<TResources> => {
  assertUniqueResponseNames(definition.resources);

  return definition;
};
