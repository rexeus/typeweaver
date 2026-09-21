import type { TypeNode } from "@typescript/typescript6";
import type { $ZodType } from "zod/v4/core";

export type ZodTypeConverter = (zodType: $ZodType) => TypeNode;
export type ZodTypeHandler = (
  zodType: $ZodType,
  convert: ZodTypeConverter
) => TypeNode | undefined;
