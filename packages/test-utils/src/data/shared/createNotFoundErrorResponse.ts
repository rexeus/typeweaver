import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  INotFoundErrorResponse,
  INotFoundErrorResponseHeader,
  INotFoundErrorResponseBody,
} from "../..";
type NotFoundErrorResponseInput = {
  statusCode?: number;
  header?: Partial<INotFoundErrorResponseHeader>;
  body?: Partial<INotFoundErrorResponseBody>;
};

export function createNotFoundErrorResponse(
  input: NotFoundErrorResponseInput = {}
): INotFoundErrorResponse {
  const defaults: INotFoundErrorResponse = {
    statusCode: HttpStatusCode.NOT_FOUND,
    header: createErrorResponseHeaders<INotFoundErrorResponseHeader>(),
    body: {
      message: "Resource not found",
      code: "NOT_FOUND_ERROR",
    },
  };

  const overrides: Partial<INotFoundErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
