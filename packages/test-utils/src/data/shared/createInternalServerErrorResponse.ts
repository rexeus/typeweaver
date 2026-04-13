import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createInternalServerErrorResponse as generatedCreateInternalServerErrorResponse } from "../../test-project/output/responses/InternalServerErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  IInternalServerErrorResponse,
  IInternalServerErrorResponseBody,
  IInternalServerErrorResponseHeader,
} from "../../index.js";

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
): IInternalServerErrorResponse {
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
  return generatedCreateInternalServerErrorResponse(responseData);
}
