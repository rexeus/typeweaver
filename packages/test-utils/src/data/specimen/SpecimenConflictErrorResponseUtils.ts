import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ISpecimenConflictErrorResponse,
  ISpecimenConflictErrorResponseHeader,
  ISpecimenConflictErrorResponseBody,
} from "../..";
import { SpecimenConflictErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";

export const createSpecimenConflictErrorResponseHeaders =
  createDataFactory<ISpecimenConflictErrorResponseHeader>(() => ({
    "X-Conflict-ID": faker.string.ulid(),
    "X-URLs": ["https://example.com/conflict"],
    "X-Literal": "conflict",
    "X-Email": "conflict@example.com",
  }));

export const createSpecimenConflictErrorResponseBody =
  createDataFactory<ISpecimenConflictErrorResponseBody>(() => ({
    message: "Specimen conflict detected with current state",
    code: "SPECIMEN_CONFLICT_ERROR",
    context: {
      specimenId: faker.string.ulid(),
      conflictingFields: ["name", "email"],
      lastModified: new Date(),
      source: "api",
      metadata: {
        version: 1,
        author: "system",
      },
    },
  }));

type SpecimenConflictErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISpecimenConflictErrorResponseHeader>;
  body?: Partial<ISpecimenConflictErrorResponseBody>;
};

export function createSpecimenConflictErrorResponse(
  input: SpecimenConflictErrorResponseInput = {}
): SpecimenConflictErrorResponse {
  const responseData = createResponse<
    ISpecimenConflictErrorResponse,
    ISpecimenConflictErrorResponseBody,
    ISpecimenConflictErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CONFLICT,
    },
    {
      body: createSpecimenConflictErrorResponseBody,
      header: createSpecimenConflictErrorResponseHeaders,
    },
    input
  );
  return new SpecimenConflictErrorResponse(responseData);
}
