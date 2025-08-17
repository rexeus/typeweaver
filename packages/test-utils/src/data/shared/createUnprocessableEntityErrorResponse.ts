import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { UnprocessableEntityErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  IUnprocessableEntityErrorResponse,
  IUnprocessableEntityErrorResponseBody,
  IUnprocessableEntityErrorResponseHeader,
} from "../..";

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
        createErrorResponseHeader<IUnprocessableEntityErrorResponseHeader>(),
    },
    input
  );
  return new UnprocessableEntityErrorResponse(responseData);
}
