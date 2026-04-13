import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createValidationErrorResponse as generatedCreateValidationErrorResponse } from "../../test-project/output/responses/ValidationErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  IValidationErrorResponse,
  IValidationErrorResponseBody,
  IValidationErrorResponseHeader,
} from "../../index.js";

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
