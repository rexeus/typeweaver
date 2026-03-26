import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import { createValidationErrorResponse as generatedCreateValidationErrorResponse } from "../../test-project/output/shared/ValidationErrorResponse";
import type {
  IValidationErrorResponse,
  IValidationErrorResponseBody,
  IValidationErrorResponseHeader,
} from "../..";

type ValidationErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IValidationErrorResponseHeader>;
  body?: Partial<IValidationErrorResponseBody>;
};

const createValidationErrorResponseBody =
  createDataFactory<IValidationErrorResponseBody>(() => ({
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
  }));

export function createValidationErrorResponse(
  input: ValidationErrorResponseInput = {}
): IValidationErrorResponse {
  const responseData = createResponse<
    IValidationErrorResponse,
    IValidationErrorResponseBody,
    IValidationErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.BAD_REQUEST,
    },
    {
      body: createValidationErrorResponseBody,
      header: createErrorResponseHeader<IValidationErrorResponseHeader>(),
    },
    input
  );
  return generatedCreateValidationErrorResponse(responseData);
}
