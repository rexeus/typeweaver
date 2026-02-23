import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { DownloadFileContentSuccessResponse } from "../..";
import { createDataFactory } from "../createDataFactory";
import { createResponse } from "../createResponse";
import type {
  IDownloadFileContentSuccessResponse,
  IDownloadFileContentSuccessResponseBody,
  IDownloadFileContentSuccessResponseHeader,
} from "../..";

export const createDownloadFileContentSuccessResponseHeader =
  createDataFactory<IDownloadFileContentSuccessResponseHeader>(() => ({
    "Content-Type": "application/octet-stream",
  }));

export const createDownloadFileContentSuccessResponseBody =
  (): IDownloadFileContentSuccessResponseBody => {
    return new ArrayBuffer(0);
  };

type DownloadFileContentSuccessResponseInput = {
  statusCode?: number;
  header?: Partial<IDownloadFileContentSuccessResponseHeader>;
  body?: IDownloadFileContentSuccessResponseBody;
};

export function createDownloadFileContentSuccessResponse(
  input: DownloadFileContentSuccessResponseInput = {}
): DownloadFileContentSuccessResponse {
  const responseData = createResponse<
    IDownloadFileContentSuccessResponse,
    IDownloadFileContentSuccessResponseBody,
    IDownloadFileContentSuccessResponseHeader
  >(
    {
      statusCode: HttpStatusCode.OK,
    },
    {
      body: () => input.body ?? createDownloadFileContentSuccessResponseBody(),
      header: createDownloadFileContentSuccessResponseHeader,
    },
    input
  );
  return new DownloadFileContentSuccessResponse(responseData);
}
