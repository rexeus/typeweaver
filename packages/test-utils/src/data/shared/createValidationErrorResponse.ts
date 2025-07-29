import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createData } from "../createData";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IValidationErrorResponse,
  IValidationErrorResponseHeader,
  IValidationErrorResponseBody,
} from "../..";
type ValidationErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IValidationErrorResponseHeader>;
  body?: Partial<IValidationErrorResponseBody>;
};

export function createValidationErrorResponse(
  input: ValidationErrorResponseInput = {}
): IValidationErrorResponse {
  const defaults: IValidationErrorResponse = {
    statusCode: HttpStatusCode.BAD_REQUEST,
    header: createErrorResponseHeaders<IValidationErrorResponseHeader>(),
    body: {
      message: "Request is invalid",
      code: "VALIDATION_ERROR",
      issues: {
        body: [
          {
            path: ["title"],
            message: "Required field missing",
            code: "invalid_type",
          },
        ],
        query: undefined,
        param: undefined,
        header: undefined,
      },
    },
  };

  const overrides: Partial<IValidationErrorResponse> = {};
  if (input.statusCode !== undefined) overrides.statusCode = input.statusCode;
  if (input.header !== undefined)
    overrides.header = createErrorResponseHeaders(input.header);
  if (input.body !== undefined)
    overrides.body = createData(defaults.body, input.body);

  return createData(defaults, overrides);
}
