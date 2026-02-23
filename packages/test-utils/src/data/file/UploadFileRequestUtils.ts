import { faker } from "@faker-js/faker";
import { HttpMethod } from "@rexeus/typeweaver-core";
import { createDataFactory } from "../createDataFactory";
import { createJwtToken } from "../createJwtToken";
import { createRequest } from "../createRequest";
import type {
  IUploadFileRequest,
  IUploadFileRequestBody,
  IUploadFileRequestHeader,
} from "../..";

export const createUploadFileRequestHeader =
  createDataFactory<IUploadFileRequestHeader>(() => ({
    "Content-Type": "application/octet-stream",
    Authorization: `Bearer ${createJwtToken()}`,
    "X-File-Name": faker.system.fileName(),
  }));

export const createUploadFileRequestBody = (): IUploadFileRequestBody => {
  const bytes = new Uint8Array(faker.number.int({ min: 8, max: 64 }));
  crypto.getRandomValues(bytes);
  return new Blob([bytes], { type: "application/octet-stream" });
};

type UploadFileRequestInput = {
  path?: string;
  body?: IUploadFileRequestBody;
  header?: Partial<IUploadFileRequestHeader>;
};

export function createUploadFileRequest(
  input: UploadFileRequestInput = {}
): IUploadFileRequest {
  return createRequest<
    IUploadFileRequest,
    IUploadFileRequestBody,
    IUploadFileRequestHeader,
    never,
    never
  >(
    {
      method: HttpMethod.POST,
      path: "/files",
    },
    {
      body: () => input.body ?? createUploadFileRequestBody(),
      header: createUploadFileRequestHeader,
    },
    input
  );
}
