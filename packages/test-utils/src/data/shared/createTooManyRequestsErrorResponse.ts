import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  ITooManyRequestsErrorResponse,
  ITooManyRequestsErrorResponseHeader,
  ITooManyRequestsErrorResponseBody,
} from "../..";
type TooManyRequestsErrorResponseInput = {
  statusCode?: number;
  header?: Partial<ITooManyRequestsErrorResponseHeader>;
  body?: Partial<ITooManyRequestsErrorResponseBody>;
};

export function createTooManyRequestsErrorResponse(
  input: TooManyRequestsErrorResponseInput = {}
): ITooManyRequestsErrorResponse {
  const defaults: ITooManyRequestsErrorResponse = {
    statusCode: HttpStatusCode.TOO_MANY_REQUESTS,
    header: createErrorResponseHeaders<ITooManyRequestsErrorResponseHeader>(),
    body: {
      message: "Too many requests",
      code: "TOO_MANY_REQUESTS_ERROR",
    },
  };

  const overrides: Partial<ITooManyRequestsErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
