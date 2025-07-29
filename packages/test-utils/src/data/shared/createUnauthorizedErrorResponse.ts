import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IUnauthorizedErrorResponse,
  IUnauthorizedErrorResponseHeader,
  IUnauthorizedErrorResponseBody,
} from "../..";
type UnauthorizedErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IUnauthorizedErrorResponseHeader>;
  body?: Partial<IUnauthorizedErrorResponseBody>;
};

export function createUnauthorizedErrorResponse(
  input: UnauthorizedErrorResponseInput = {}
): IUnauthorizedErrorResponse {
  const defaults: IUnauthorizedErrorResponse = {
    statusCode: HttpStatusCode.UNAUTHORIZED,
    header: createErrorResponseHeaders<IUnauthorizedErrorResponseHeader>(),
    body: {
      message: "Unauthorized request",
      code: "UNAUTHORIZED_ERROR",
    },
  };

  const overrides: Partial<IUnauthorizedErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
