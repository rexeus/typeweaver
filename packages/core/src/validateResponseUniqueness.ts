import { DuplicateResponseNameError } from "./DuplicateResponseNameError.js";
import type { ResponseDefinition } from "./defineResponse.js";
import type { ResourceDefinition } from "./defineSpec.js";

/**
 * Iterates through all responses in a spec definition and validates
 * that response names are globally unique.
 *
 * @throws DuplicateResponseNameError if duplicate response names are found
 */
export const validateUniqueResponseNames = (
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
