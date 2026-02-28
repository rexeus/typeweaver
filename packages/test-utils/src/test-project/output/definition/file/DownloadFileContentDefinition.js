import { HttpMethod, HttpOperationDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { sharedResponses } from "../shared";
export default new HttpOperationDefinition({
  operationId: "DownloadFileContent",
  path: "/files/:fileId/content",
  summary: "Download file content",
  method: HttpMethod.GET,
  request: {
    param: z.object({ fileId: z.ulid() }),
    header: z.object({ Authorization: z.string() }),
  },
  responses: [
    {
      statusCode: HttpStatusCode.OK,
      description: "File content retrieved successfully",
      body: z.any(),
      name: "DownloadFileContentSuccess",
      header: z.object({ "Content-Type": z.literal("application/octet-stream") }),
    },
    ...sharedResponses,
  ],
});
