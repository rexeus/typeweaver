import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IForbiddenErrorResponse,
  IForbiddenErrorResponseHeader,
  IForbiddenErrorResponseBody,
} from "../..";
type ForbiddenErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IForbiddenErrorResponseHeader>;
  body?: Partial<IForbiddenErrorResponseBody>;
};

export function createForbiddenErrorResponse(
  input: ForbiddenErrorResponseInput = {}
): IForbiddenErrorResponse {
  const defaults: IForbiddenErrorResponse = {
    statusCode: HttpStatusCode.FORBIDDEN,
    header: createErrorResponseHeaders<IForbiddenErrorResponseHeader>(),
    body: {
      message: "Forbidden request",
      code: "FORBIDDEN_ERROR",
    },
  };

  const overrides: Partial<IForbiddenErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
