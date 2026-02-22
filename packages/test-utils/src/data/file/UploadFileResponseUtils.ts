import { faker } from "@faker-js/faker";
import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { UploadFileSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IUploadFileSuccessResponse,
  IUploadFileSuccessResponseBody,
  IUploadFileSuccessResponseHeader,
} from "../..";

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
  input: UploadFileSuccessResponseInput = {},
): UploadFileSuccessResponse {
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
    input,
  );
  return new UploadFileSuccessResponse(responseData);
}
