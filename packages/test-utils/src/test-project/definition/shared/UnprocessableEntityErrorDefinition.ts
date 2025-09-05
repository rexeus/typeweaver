import {
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import { defaultResponseHeader } from "./defaultResponseHeader";

export default new HttpResponseDefinition({
  statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
  name: "UnprocessableEntityError",
  description: "Unprocessable entity error",
  header: defaultResponseHeader,
  body: z.object({
    message: z.literal("Unprocessable entity"),
    code: z.literal("UNPROCESSABLE_ENTITY_ERROR"),
  }),
});
