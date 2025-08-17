import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { ForbiddenErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  IForbiddenErrorResponse,
  IForbiddenErrorResponseBody,
  IForbiddenErrorResponseHeader,
} from "../..";

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
): ForbiddenErrorResponse {
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
  return new ForbiddenErrorResponse(responseData);
}
