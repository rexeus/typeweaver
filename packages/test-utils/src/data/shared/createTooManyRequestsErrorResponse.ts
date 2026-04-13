import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createTooManyRequestsErrorResponse as generatedCreateTooManyRequestsErrorResponse } from "../../test-project/output/responses/TooManyRequestsErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  ITooManyRequestsErrorResponse,
  ITooManyRequestsErrorResponseBody,
  ITooManyRequestsErrorResponseHeader,
} from "../../index.js";

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
): ITooManyRequestsErrorResponse {
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
  return generatedCreateTooManyRequestsErrorResponse(responseData);
}
