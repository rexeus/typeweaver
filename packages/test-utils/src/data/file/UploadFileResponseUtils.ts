import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createUploadFileSuccessResponse as generatedCreateUploadFileSuccessResponse } from "../../test-project/output/responses/UploadFileSuccessResponse.js";
import { createDataFactory } from "../createDataFactory.js";
import { createResponse } from "../createResponse.js";
import type {
  IUploadFileSuccessResponse,
  IUploadFileSuccessResponseBody,
  IUploadFileSuccessResponseHeader,
} from "../../index.js";

export const createUploadFileSuccessResponseHeader =
  createDataFactory<IUploadFileSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createUploadFileSuccessResponseBody =
  createDataFactory<IUploadFileSuccessResponseBody>(() => ({
    id: faker.string.ulid(),
    name: faker.system.fileName(),
    size: faker.number.int({ min: 1, max: 10_000_000 }),
    mimeType: faker.system.mimeType(),
    createdAt: faker.date.past().toISOString(),
  }));

type UploadFileSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IUploadFileSuccessResponseHeader>;
  body?: Partial<IUploadFileSuccessResponseBody>;
};

export function createUploadFileSuccessResponse(
  input: UploadFileSuccessResponseInput = {}
): IUploadFileSuccessResponse {
  const responseData = createResponse<
    IUploadFileSuccessResponse,
    IUploadFileSuccessResponseBody,
    IUploadFileSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.CREATED,
    },
    {
      body: createUploadFileSuccessResponseBody,
      header: createUploadFileSuccessResponseHeader,
    },
    input
  );
  return generatedCreateUploadFileSuccessResponse(responseData);
}
