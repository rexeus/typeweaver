import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import type {
  ISpecimenNotFoundErrorResponse,
  ISpecimenNotFoundErrorResponseHeader,
  ISpecimenNotFoundErrorResponseBody,
} from "../..";
import { SpecimenNotFoundErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";

export const createSpecimenNotFoundErrorResponseHeader =
  createDataFactory<ISpecimenNotFoundErrorResponseHeader>(() => ({
    "X-Search-ID": faker.string.ulid(),
    "X-Available": ["true"],
    "X-Count": "0",
  }));

export const createSpecimenNotFoundErrorResponseBody =
  createDataFactory<ISpecimenNotFoundErrorResponseBody>(() => ({
    message: "Specimen not found in the system",
    code: "SPECIMEN_NOT_FOUND_ERROR",
    searchCriteria: {
      requestedIds: [faker.string.ulid()],
      suggestions: ["alternative-1", "alternative-2"],
    },
  }));

type SpecimenNotFoundErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ISpecimenNotFoundErrorResponseHeader>;
  body?: Partial<ISpecimenNotFoundErrorResponseBody>;
};

export function createSpecimenNotFoundErrorResponse(
  input: SpecimenNotFoundErrorResponseInput = {}
): SpecimenNotFoundErrorResponse {
  const responseData = createResponse<
    ISpecimenNotFoundErrorResponse,
    ISpecimenNotFoundErrorResponseBody,
    ISpecimenNotFoundErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.NOT_FOUND,
    },
    {
      body: createSpecimenNotFoundErrorResponseBody,
      header: createSpecimenNotFoundErrorResponseHeader,
    },
    input
  );
  return new SpecimenNotFoundErrorResponse(responseData);
}
