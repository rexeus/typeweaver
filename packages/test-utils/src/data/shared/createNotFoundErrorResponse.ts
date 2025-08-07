import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import type {
  INotFoundErrorResponse,
  INotFoundErrorResponseHeader,
  INotFoundErrorResponseBody,
} from "../..";
import { NotFoundErrorResponse } from "../..";

type NotFoundErrorResponseInput = {
  statusCode?: number;
  header?: Partial<INotFoundErrorResponseHeader>;
  body?: Partial<INotFoundErrorResponseBody>;
};

const createNotFoundErrorResponseBody =
  createDataFactory<INotFoundErrorResponseBody>(() => ({
    message: "Resource not found",
    code: "NOT_FOUND_ERROR",
  }));

export function createNotFoundErrorResponse(
  input: NotFoundErrorResponseInput = {}
): NotFoundErrorResponse {
  const responseData = createResponse<
    INotFoundErrorResponse,
    INotFoundErrorResponseBody,
    INotFoundErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.NOT_FOUND,
    },
    {
      body: createNotFoundErrorResponseBody,
      header: createErrorResponseHeader<INotFoundErrorResponseHeader>(),
    },
    input
  );
  return new NotFoundErrorResponse(responseData);
}
