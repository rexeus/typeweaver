import {
  defineOperation,
  defineResponse,
  HttpMethod,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader, sharedResponses } from "../shared";
import { fileMetadataSchema } from "./fileSchema";

export default defineOperation({
  operationId: "UploadFile",
  path: "/files",
  summary: "Upload a file",
  method: HttpMethod.POST,
  request: {
    body: z.any(),
    header: z.object({
      "Content-Type": z.literal("application/octet-stream"),
      Authorization: z.string(),
      "X-File-Name": z.string(),
    }),
  },
  responses: [
    defineResponse({
      statusCode: HttpStatusCode.CREATED,
      description: "File uploaded successfully",
      body: fileMetadataSchema,
      name: "UploadFileSuccess",
      header: defaultResponseHeader,
    }),
    ...sharedResponses,
  ],
});
