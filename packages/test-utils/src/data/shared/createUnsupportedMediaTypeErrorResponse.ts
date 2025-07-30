import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import { createErrorResponseHeaders } from "../createErrorResponseHeaders";
import type {
  IUnsupportedMediaTypeErrorResponse,
  IUnsupportedMediaTypeErrorResponseHeader,
  IUnsupportedMediaTypeErrorResponseBody,
} from "../..";
import { UnsupportedMediaTypeErrorResponse } from "../..";

type UnsupportedMediaTypeErrorResponseInput = {
  statusCode?: number;
  header?: Partial<IUnsupportedMediaTypeErrorResponseHeader>;
  body?: Partial<IUnsupportedMediaTypeErrorResponseBody>;
};

const createUnsupportedMediaTypeErrorResponseBody =
  createDataFactory<IUnsupportedMediaTypeErrorResponseBody>(() => ({
    message: "Unsupported media type",
    code: "UNSUPPORTED_MEDIA_TYPE_ERROR",
    context: {
      contentType: faker.helpers.arrayElement([
        "text/plain",
        "application/xml",
        "text/html",
        "application/x-www-form-urlencoded",
      ]),
    },
    expectedValues: {
      contentTypes: ["application/json"] as const,
    },
  }));

export function createUnsupportedMediaTypeErrorResponse(
  input: UnsupportedMediaTypeErrorResponseInput = {}
): UnsupportedMediaTypeErrorResponse {
  const responseData = createResponse<
    IUnsupportedMediaTypeErrorResponse,
    IUnsupportedMediaTypeErrorResponseBody,
    IUnsupportedMediaTypeErrorResponseHeader
  >(
    {
      statusCode: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE,
    },
    {
      body: createUnsupportedMediaTypeErrorResponseBody,
      header:
        createErrorResponseHeaders<IUnsupportedMediaTypeErrorResponseHeader>(),
    },
    input
  );
  return new UnsupportedMediaTypeErrorResponse(responseData);
}
