import { z } from "zod";
import { fromZod } from "../../../src/tsTypeGenerator.js";
import { print } from "../../../src/tsTypePrinter.js";

export function toTs(schema: z.ZodType): string {
  return print(fromZod(schema));
}

export const captureError = (action: () => void): unknown => {
  try {
    action();
  } catch (error) {
    return error;
  }

  return undefined;
};
