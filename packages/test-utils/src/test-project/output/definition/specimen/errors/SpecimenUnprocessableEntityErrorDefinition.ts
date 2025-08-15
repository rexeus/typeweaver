import {
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";

export default new HttpResponseDefinition({
  name: "SpecimenUnprocessableEntityError",
  body: z.object({
    message: z.literal("Specimen data validation failed"),
    code: z.literal("SPECIMEN_UNPROCESSABLE_ENTITY_ERROR"),
    validationErrors: z.array(
      z.object({
        field: z.string(),
        value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
        reason: z.enum([
          "invalid_format",
          "required",
          "too_long",
          "too_short",
          "out_of_range",
        ]),
        expected: z.union([z.string(), z.array(z.string())]).optional(),
        metadata: z
          .record(z.string(), z.union([z.string(), z.number()]))
          .optional(),
      }),
    ),
    summary: z.object({
      totalErrors: z.number(),
      fieldCount: z.number(),
      timestamp: z.date(),
      requestId: z.uuid(),
    }),
  }),
  header: z.object({
    "X-Validation-ID": z.uuid(),
    "X-Field-Count": z.string(),
    "X-Error-Types": z.array(z.string()),
    "X-Request-ID": z.uuid(),
    "X-Timestamp": z.string(),
  }),
  statusCode: HttpStatusCode.UNPROCESSABLE_ENTITY,
  description:
    "Specimen unprocessable entity error with comprehensive validation details",
});
