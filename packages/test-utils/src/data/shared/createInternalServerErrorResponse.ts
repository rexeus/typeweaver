import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IInternalServerErrorResponse,
  IInternalServerErrorResponseHeader,
  IInternalServerErrorResponseBody,
} from "../..";
import { InternalServerErrorResponse } from "../..";

type InternalServerErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IInternalServerErrorResponseHeader>;
  body?: Partial<IInternalServerErrorResponseBody>;
};

const createInternalServerErrorResponseBody =
  createDataFactory<IInternalServerErrorResponseBody>(() => ({
    message: "Internal server error occurred",
    code: "INTERNAL_SERVER_ERROR",
  }));

export function createInternalServerErrorResponse(
  input: InternalServerErrorResponseInput = {}
): InternalServerErrorResponse {
  const responseData = createResponse<
    IInternalServerErrorResponse,
    IInternalServerErrorResponseBody,
    IInternalServerErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
    },
    {
      body: createInternalServerErrorResponseBody,
      header: createErrorResponseHeaders<IInternalServerErrorResponseHeader>(),
    },
    input
  );
  return new InternalServerErrorResponse(responseData);
}
