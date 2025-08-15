import {
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";

export default new HttpResponseDefinition({
  name: "SpecimenConflictError",
  body: z.object({
    message: z.literal("Specimen conflict detected with current state"),
    code: z.literal("SPECIMEN_CONFLICT_ERROR"),
    context: z.object({
      specimenId: z.uuid(),
      conflictingFields: z.array(z.string()),
      lastModified: z.date(),
      source: z.url(),
      metadata: z.object({
        version: z.number(),
        author: z.email(),
      }),
    }),
  }),
  header: z.object({
    "X-Conflict-ID": z.uuid(),
    "X-JWT": z.jwt().optional(),
    "X-URLs": z.array(z.url()),
    "X-Literal": z.literal("conflict"),
    "X-Email": z.email(),
  }),
  statusCode: HttpStatusCode.CONFLICT,
  description: "Specimen conflict error with comprehensive context data",
});
