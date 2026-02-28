import { HttpResponseDefinition, HttpStatusCode } from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";

export default new HttpResponseDefinition({
  name: "UnsupportedMediaTypeError",
  body: z.object({
    message: z.literal("Unsupported media type"),
    code: z.literal("UNSUPPORTED_MEDIA_TYPE_ERROR"),
    context: z.object({
      contentType: z.string(),
    }),
    expectedValues: z.object({
      contentTypes: z.tuple([z.literal("application/json")]),
    }),
  }),
  header: defaultResponseHeader,
  statusCode: HttpStatusCode.UNSUPPORTED_MEDIA_TYPE,
  description: "Unsupported media type",
});
