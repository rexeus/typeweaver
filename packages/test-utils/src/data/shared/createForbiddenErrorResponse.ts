import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import type {
  IForbiddenErrorResponse,
  IForbiddenErrorResponseHeader,
  IForbiddenErrorResponseBody,
} from "../..";
import { ForbiddenErrorResponse } from "../..";

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
