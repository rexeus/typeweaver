import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createUnprocessableEntityErrorResponse as generatedCreateUnprocessableEntityErrorResponse } from "../../test-project/output/shared/UnprocessableEntityErrorResponse";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  IUnprocessableEntityErrorResponse,
  IUnprocessableEntityErrorResponseBody,
  IUnprocessableEntityErrorResponseHeader,
} from "../../index.js";

type UnprocessableEntityErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IUnprocessableEntityErrorResponseHeader>;
  body?: Partial<IUnprocessableEntityErrorResponseBody>;
};

const createUnprocessableEntityErrorResponseBody =
  createDataFactory<IUnprocessableEntityErrorResponseBody>(() => ({
    message: "Unprocessable entity",
    code: "UNPROCESSABLE_ENTITY_ERROR",
  }));

export function createUnprocessableEntityErrorResponse(
  input: UnprocessableEntityErrorResponseInput = {}
): IUnprocessableEntityErrorResponse {
  const responseData = createResponse<
    IUnprocessableEntityErrorResponse,
    IUnprocessableEntityErrorResponseBody,
    IUnprocessableEntityErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
    },
    {
      body: createUnprocessableEntityErrorResponseBody,
      header:
        createErrorResponseHeader<IUnprocessableEntityErrorResponseHeader>(),
    },
    input
  );
  return generatedCreateUnprocessableEntityErrorResponse(responseData);
}
