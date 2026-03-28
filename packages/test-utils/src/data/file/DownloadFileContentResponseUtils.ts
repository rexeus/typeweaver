import { HttpStatusCode } from "@rexeus/typeweaver-core";
import { createDownloadFileContentSuccessResponse as generatedCreateDownloadFileContentSuccessResponse } from "../../test-project/output/responses/DownloadFileContentSuccessResponse";
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
): IDownloadFileContentSuccessResponse {
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
  return generatedCreateDownloadFileContentSuccessResponse(responseData);
}
