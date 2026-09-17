import { fromZod } from "@rexeus/typeweaver-zod-to-json-schema";
import { z } from "zod";

export const objectResult = fromZod(
  z.object({
    id: z.uuid(),
    name: z.string().optional(),
  })
);

export const lossyResult = fromZod(z.string().transform(value => value.length));

export const requireRepresentableSchema = (schema: z.ZodType) => {
  const result = fromZod(schema);
  if (result.warnings.length > 0) {
    throw new Error(
      result.warnings
        .map(
          warning => `${warning.code} at ${warning.path}: ${warning.message}`
        )
        .join("\n")
    );
  }
  return result.schema;
};
