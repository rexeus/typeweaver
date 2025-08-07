import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import type {
  ITooManyRequestsErrorResponse,
  ITooManyRequestsErrorResponseHeader,
  ITooManyRequestsErrorResponseBody,
} from "../..";
import { TooManyRequestsErrorResponse } from "../..";

type TooManyRequestsErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITooManyRequestsErrorResponseHeader>;
  body?: Partial<ITooManyRequestsErrorResponseBody>;
};

const createTooManyRequestsErrorResponseBody =
  createDataFactory<ITooManyRequestsErrorResponseBody>(() => ({
    message: "Too many requests",
    code: "TOO_MANY_REQUESTS_ERROR",
  }));

export function createTooManyRequestsErrorResponse(
  input: TooManyRequestsErrorResponseInput = {}
): TooManyRequestsErrorResponse {
  const responseData = createResponse<
    ITooManyRequestsErrorResponse,
    ITooManyRequestsErrorResponseBody,
    ITooManyRequestsErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    },
    {
      body: createTooManyRequestsErrorResponseBody,
      header: createErrorResponseHeader<ITooManyRequestsErrorResponseHeader>(),
    },
    input
  );
  return new TooManyRequestsErrorResponse(responseData);
}
