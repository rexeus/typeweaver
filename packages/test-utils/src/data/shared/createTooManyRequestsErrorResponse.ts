import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createTooManyRequestsErrorResponse as generatedCreateTooManyRequestsErrorResponse } from "../../test-project/output/shared/TooManyRequestsErrorResponse";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  ITooManyRequestsErrorResponse,
  ITooManyRequestsErrorResponseBody,
  ITooManyRequestsErrorResponseHeader,
} from "../..";

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
