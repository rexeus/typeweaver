import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createUnsupportedMediaTypeErrorResponse as generatedCreateUnsupportedMediaTypeErrorResponse } from "../../test-project/output/responses/UnsupportedMediaTypeErrorResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createErrorResponseHeader } from "../createErrorResponseHeader.js";
import { createResponse } from "../createResponse.js";
import type {
  IUnsupportedMediaTypeErrorResponse,
  IUnsupportedMediaTypeErrorResponseBody,
  IUnsupportedMediaTypeErrorResponseHeader,
} from "../../index.js";

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
): IUnsupportedMediaTypeErrorResponse {
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
  return generatedCreateUnsupportedMediaTypeErrorResponse(responseData);
}
