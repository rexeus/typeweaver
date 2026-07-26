type SchemaInfo = {
  readonly originalKey: string;
  readonly isArray: boolean;
};

export declare abstract class Validator {
  protected analyzeSchema(
    shape: Record<string, unknown>,
    caseSensitive: boolean,
  ): Map<string, SchemaInfo>;
  protected getSchema(headerSchema: HttpHeaderSchema | HttpQuerySchema): Record<string, unknown>;
  protected safeParseAs<TOutput>(schema: z.ZodType, input: unknown): z.ZodSafeParseResult<TOutput>;
  protected requireRequestSchema<TSchema extends z.ZodType>(
    schema: TSchema | undefined,
    requestPart: "body" | "header" | "param" | "query",
  ): TSchema;
  protected findMultiplicityIssues(
    data: unknown,
    schema: HttpHeaderSchema | HttpQuerySchema,
    caseSensitive: boolean,
  ): z.core.$ZodIssue[];
  protected coerceToSchema(
    data: unknown,
    shape: Record<string, unknown>,
    caseSensitive: boolean,
  ): unknown;
  protected coerceHeaderToSchema(header: unknown, schema: HttpHeaderSchema): unknown;
  protected coerceQueryToSchema(query: unknown, schema: HttpQuerySchema): unknown;
}
import type { HttpHeaderSchema, HttpQuerySchema } from "@rexeus/typeweaver-core";
import type { z } from "zod";
