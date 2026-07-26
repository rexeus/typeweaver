import {
  fromZod,
  print,
  UnsupportedZodTypeError,
} from "@rexeus/typeweaver-zod-to-ts";
import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  age: z.number().optional(),
});

export const userType = print(fromZod(userSchema));

export const describeUnsupportedSchema = (schema: z.ZodType): string => {
  try {
    fromZod(schema);
    return "supported";
  } catch (error: unknown) {
    if (error instanceof UnsupportedZodTypeError) {
      return `${error.code}: ${error.schemaKind}: ${error.reason}`;
    }
    throw error;
  }
};
