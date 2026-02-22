import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IDownloadFileContentRequest,
  IDownloadFileContentRequestHeader,
  IDownloadFileContentRequestParam,
} from "../..";

export const createDownloadFileContentRequestHeader =
  createDataFactory<IDownloadFileContentRequestHeader>(() => ({
    Authorization: `Bearer ${createJwtToken()}`,
  }));

export const createDownloadFileContentRequestParam =
  createDataFactory<IDownloadFileContentRequestParam>(() => ({
    fileId: faker.string.ulid(),
  }));

type DownloadFileContentRequestInput = {
  method?: HttpMethod;
  path?: string;
  header?: Partial<IDownloadFileContentRequestHeader>;
  param?: Partial<IDownloadFileContentRequestParam>;
};

export function createDownloadFileContentRequest(
  input: DownloadFileContentRequestInput = {},
): IDownloadFileContentRequest {
  const param = input.param
    ? createDownloadFileContentRequestParam(input.param)
    : createDownloadFileContentRequestParam();

  const dynamicPath = input.path ?? `/files/${param.fileId}/content`;

  return createRequest<
    IDownloadFileContentRequest,
    never,
    IDownloadFileContentRequestHeader,
    IDownloadFileContentRequestParam,
    never
  >(
    {
      method: HttpMethod.GET,
      path: dynamicPath,
    },
    {
      header: createDownloadFileContentRequestHeader,
      param: () => param,
    },
    input,
  );
}
