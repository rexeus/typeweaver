import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import {
  defaultRequestHeadersWithoutPayload,
  defaultResponseHeader,
  sharedResponses,
} from "../shared";
import { fileMetadataSchema } from "./fileSchema";

export default defineOperation({
  operationId: "GetFileMetadata",
  path: "/files/:fileId",
  summary: "Get file metadata",
  method: HttpMethod.GET,
  request: {
    param: z.object({
      fileId: z.ulid(),
    }),
    header: defaultRequestHeadersWithoutPayload,
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.OK,
      description: "File metadata retrieved successfully",
      body: fileMetadataSchema,
      name: "GetFileMetadataSuccess",
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
