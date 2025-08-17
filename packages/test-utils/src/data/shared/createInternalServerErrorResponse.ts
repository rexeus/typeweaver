import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { InternalServerErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  IInternalServerErrorResponse,
  IInternalServerErrorResponseBody,
  IInternalServerErrorResponseHeader,
} from "../..";

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
      header: createErrorResponseHeader<IInternalServerErrorResponseHeader>(),
    },
    input
  );
  return new InternalServerErrorResponse(responseData);
}
