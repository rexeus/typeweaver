import { HttpMethod } from "@rexeus/typeweaver-core";
import { faker } from "@faker-js/faker";
import { createDataFactory } from "../createDataFactory.js";
import { createJwtToken } from "../createJwtToken.js";
import { createRequest } from "../createRequest.js";
import type {
  IGetFileMetadataRequest,
  IGetFileMetadataRequestHeader,
  IGetFileMetadataRequestParam,
} from "../../index.js";

export const createGetFileMetadataRequestHeader =
  createDataFactory<IGetFileMetadataRequestHeader>(() => ({
    Accept: "application/json",
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createGetFileMetadataRequestParam =
  createDataFactory<IGetFileMetadataRequestParam>(() => ({
    fileId: faker.string.ulid(),
  }));

type GetFileMetadataRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IGetFileMetadataRequestHeader>;
  param?: Partial<IGetFileMetadataRequestParam>;
};

export function createGetFileMetadataRequest(
  input: GetFileMetadataRequestInput = {}
): IGetFileMetadataRequest {
  const param = input.param
    ? createGetFileMetadataRequestParam(input.param)
    : createGetFileMetadataRequestParam();

  const dynamicPath = input.path ?? `/files/${param.fileId}`;

  return createRequest<
    IGetFileMetadataRequest,
    never,
    IGetFileMetadataRequestHeader,
    IGetFileMetadataRequestParam,
    never
  >(
    {
      method: HttpMethod.GET,
      path: dynamicPath,
    },
    {
      header: createGetFileMetadataRequestHeader,
      param: () => param,
    },
    input
  );
}
