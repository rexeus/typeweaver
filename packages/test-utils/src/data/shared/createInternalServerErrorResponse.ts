import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IInternalServerErrorResponse,
  IInternalServerErrorResponseHeader,
  IInternalServerErrorResponseBody,
} from "../..";
type InternalServerErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IInternalServerErrorResponseHeader>;
  body?: Partial<IInternalServerErrorResponseBody>;
};

export function createInternalServerErrorResponse(
  input: InternalServerErrorResponseInput = {}
): IInternalServerErrorResponse {
  const defaults: IInternalServerErrorResponse = {
    statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    header: createErrorResponseHeaders<IInternalServerErrorResponseHeader>(),
    body: {
      message: "Internal server error occurred",
      code: "INTERNAL_SERVER_ERROR",
    },
  };

  const overrides: Partial<IInternalServerErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
