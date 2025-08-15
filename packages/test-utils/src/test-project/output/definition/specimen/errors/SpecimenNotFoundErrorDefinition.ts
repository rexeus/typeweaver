import {
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";

export default new HttpResponseDefinition({
  name: "SpecimenNotFoundError",
  body: z.object({
    message: z.literal("Specimen not found in the system"),
    code: z.literal("SPECIMEN_NOT_FOUND_ERROR"),
    searchCriteria: z.object({
      requestedIds: z.array(z.uuid()),
      emails: z.array(z.email()).optional(),
      suggestions: z.array(z.string()),
      alternatives: z
        .array(
          z.object({
            id: z.uuid(),
            similarity: z.number(),
            available: z.boolean(),
          }),
        )
        .optional(),
    }),
  }),
  header: z.object({
    "X-Search-ID": z.ulid(),
    "X-Email": z.email().optional(),
    "X-Available": z.array(z.string()),
    "X-Count": z.string(),
    "X-Suggestions": z.array(z.string()).optional(),
  }),
  statusCode: HttpStatusCode.NOT_FOUND,
  description: "Specimen not found error with detailed search context",
});
