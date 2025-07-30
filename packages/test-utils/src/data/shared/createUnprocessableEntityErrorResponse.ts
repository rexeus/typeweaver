import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IUnprocessableEntityErrorResponse,
  IUnprocessableEntityErrorResponseHeader,
  IUnprocessableEntityErrorResponseBody,
} from "../..";
import { UnprocessableEntityErrorResponse } from "../..";

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
): UnprocessableEntityErrorResponse {
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
        createErrorResponseHeaders<IUnprocessableEntityErrorResponseHeader>(),
    },
    input
  );
  return new UnprocessableEntityErrorResponse(responseData);
}
