import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { GetFileMetadataSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IGetFileMetadataSuccessResponse,
  IGetFileMetadataSuccessResponseBody,
  IGetFileMetadataSuccessResponseHeader,
} from "../..";

export const createGetFileMetadataSuccessResponseHeader =
  createDataFactory<IGetFileMetadataSuccessResponseHeader>(() => ({
    "Content-Type": "application/json",
  }));

export const createGetFileMetadataSuccessResponseBody =
  createDataFactory<IGetFileMetadataSuccessResponseBody>(() => ({
    id: faker.string.ulid(),
    name: faker.system.fileName(),
    size: faker.number.int({ min: 1, max: 10_000_000 }),
    mimeType: faker.system.mimeType(),
    createdAt: faker.date.past().toISOString(),
  }));

type GetFileMetadataSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IGetFileMetadataSuccessResponseHeader>;
  body?: Partial<IGetFileMetadataSuccessResponseBody>;
};

export function createGetFileMetadataSuccessResponse(
  input: GetFileMetadataSuccessResponseInput = {}
): GetFileMetadataSuccessResponse {
  const responseData = createResponse<
    IGetFileMetadataSuccessResponse,
    IGetFileMetadataSuccessResponseBody,
    IGetFileMetadataSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: createGetFileMetadataSuccessResponseBody,
      header: createGetFileMetadataSuccessResponseHeader,
    },
    input
  );
  return new GetFileMetadataSuccessResponse(responseData);
}
