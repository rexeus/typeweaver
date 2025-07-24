import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ISpecimenConflictErrorResponse,
  ISpecimenConflictErrorResponseHeader,
  ISpecimenConflictErrorResponseBody,
} from "../..";
import { createData } from "../createData";

export function createSpecimenConflictErrorResponseHeaders(
  input: Partial<ISpecimenConflictErrorResponseHeader> = {}
): ISpecimenConflictErrorResponseHeader {
  const defaults: ISpecimenConflictErrorResponseHeader = {
    "X-Conflict-ID": faker.string.ulid(),
    "X-URLs": ["https://example.com/conflict"],
    "X-Literal": "conflict",
    "X-Email": "conflict@example.com",
  };

  return createData(defaults, input);
}

export function createSpecimenConflictErrorResponseBody(
  input: Partial<ISpecimenConflictErrorResponseBody> = {}
): ISpecimenConflictErrorResponseBody {
  const defaults: ISpecimenConflictErrorResponseBody = {
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
  };

  return createData(defaults, input);
}

type SpecimenConflictErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISpecimenConflictErrorResponseHeader>;
  body?: Partial<ISpecimenConflictErrorResponseBody>;
};

export function createSpecimenConflictErrorResponse(
  input: SpecimenConflictErrorResponseInput = {}
): ISpecimenConflictErrorResponse {
  const defaults: ISpecimenConflictErrorResponse = {
    statusCode: HttpStatusCode.CONFLICT,
    header: createSpecimenConflictErrorResponseHeaders(),
    body: createSpecimenConflictErrorResponseBody(),
  };

  const overrides: Partial<ISpecimenConflictErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createSpecimenConflictErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createSpecimenConflictErrorResponseBody(input.body);

  return createData(defaults, overrides);
}