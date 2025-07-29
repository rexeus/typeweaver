import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ISpecimenNotFoundErrorResponse,
  ISpecimenNotFoundErrorResponseHeader,
  ISpecimenNotFoundErrorResponseBody,
} from "../..";
import { createData } from "../createData";

export function createSpecimenNotFoundErrorResponseHeaders(
  input: Partial<ISpecimenNotFoundErrorResponseHeader> = {}
): ISpecimenNotFoundErrorResponseHeader {
  const defaults: ISpecimenNotFoundErrorResponseHeader = {
    "X-Search-ID": faker.string.ulid(),
    "X-Available": ["true"],
    "X-Count": "0",
  };

  return createData(defaults, input);
}

export function createSpecimenNotFoundErrorResponseBody(
  input: Partial<ISpecimenNotFoundErrorResponseBody> = {}
): ISpecimenNotFoundErrorResponseBody {
  const defaults: ISpecimenNotFoundErrorResponseBody = {
    message: "Specimen not found in the system",
    code: "SPECIMEN_NOT_FOUND_ERROR",
    searchCriteria: {
      requestedIds: [faker.string.ulid()],
      suggestions: ["alternative-1", "alternative-2"],
    },
  };

  return createData(defaults, input);
}

type SpecimenNotFoundErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISpecimenNotFoundErrorResponseHeader>;
  body?: Partial<ISpecimenNotFoundErrorResponseBody>;
};

export function createSpecimenNotFoundErrorResponse(
  input: SpecimenNotFoundErrorResponseInput = {}
): ISpecimenNotFoundErrorResponse {
  const defaults: ISpecimenNotFoundErrorResponse = {
    statusCode: HttpStatusCode.NOT_FOUND,
    header: createSpecimenNotFoundErrorResponseHeaders(),
    body: createSpecimenNotFoundErrorResponseBody(),
  };

  const overrides: Partial<ISpecimenNotFoundErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createSpecimenNotFoundErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createSpecimenNotFoundErrorResponseBody(input.body);

  return createData(defaults, overrides);
}
