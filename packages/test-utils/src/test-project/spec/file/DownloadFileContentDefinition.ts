import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { sharedResponses } from "../shared/index.js";

export const DownloadFileContentDefinition = defineOperation({
  operationId: "DownloadFileContent",
  path: "/files/:fileId/content",
  summary: "Download file content",
  method: HttpMethod.GET,
  request: {
    param: z.object({
      fileId: z.ulid(),
    }),
    header: z.object({
      Authorization: z.string(),
    }),
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.OK,
      description: "File content retrieved successfully",
      body: z.any(),
      name: "DownloadFileContentSuccess",
      header: z.object({
        "Content-Type": z.literal("application/octet-stream"),
      }),
    }),
    ...sharedResponses,
  ],
});
