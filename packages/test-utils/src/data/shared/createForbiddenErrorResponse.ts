import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createForbiddenErrorResponse as generatedCreateForbiddenErrorResponse } from "../../test-project/output/responses/ForbiddenErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  IForbiddenErrorResponse,
  IForbiddenErrorResponseBody,
  IForbiddenErrorResponseHeader,
} from "../../index.js";

type ForbiddenErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IForbiddenErrorResponseHeader>;
  body?: Partial<IForbiddenErrorResponseBody>;
};

const createForbiddenErrorResponseBody =
  createDataFactory<IForbiddenErrorResponseBody>(() => ({
    message: "Forbidden request",
    code: "FORBIDDEN_ERROR",
  }));

export function createForbiddenErrorResponse(
  input: ForbiddenErrorResponseInput = {}
): IForbiddenErrorResponse {
  const responseData = createResponse<
    IForbiddenErrorResponse,
    IForbiddenErrorResponseBody,
    IForbiddenErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.FORBIDDEN,
    },
    {
      body: createForbiddenErrorResponseBody,
      header: createErrorResponseHeader<IForbiddenErrorResponseHeader>(),
    },
    input
  );
  return generatedCreateForbiddenErrorResponse(responseData);
}
