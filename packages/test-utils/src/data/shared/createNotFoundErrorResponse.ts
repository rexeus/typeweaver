import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import { createNotFoundErrorResponse as generatedCreateNotFoundErrorResponse } from "../../test-project/output/shared/NotFoundErrorResponse";
import type {
  INotFoundErrorResponse,
  INotFoundErrorResponseBody,
  INotFoundErrorResponseHeader,
} from "../..";

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
): INotFoundErrorResponse {
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
  return generatedCreateNotFoundErrorResponse(responseData);
}
