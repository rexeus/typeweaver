import { faker } from "@faker-js/faker";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { UnsupportedMediaTypeErrorResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createErrorResponseHeader } from "../createErrorResponseHeader";
import { createResponse } from "../createResponse";
import type {
  IUnsupportedMediaTypeErrorResponse,
  IUnsupportedMediaTypeErrorResponseBody,
  IUnsupportedMediaTypeErrorResponseHeader,
} from "../..";

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
        createErrorResponseHeader<IUnsupportedMediaTypeErrorResponseHeader>(),
    },
    input
  );
  return new UnsupportedMediaTypeErrorResponse(responseData);
}
