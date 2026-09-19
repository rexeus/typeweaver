type SchemaInfo = {
  readonly originalKey: string;
  readonly isArray: boolean;
};

export declare abstract class Validator {
  protected analyzeSchema(
    shape: Record<string, unknown>,
    caseSensitive: boolean,
  ): Map<string, SchemaInfo>;
  protected getSchema(
    headerSchema: HttpHeaderSchemaLike | HttpQuerySchema,
  ): Record<string, unknown>;
  protected safeParseAs<TOutput>(schema: z.ZodType, input: unknown): z.ZodSafeParseResult<TOutput>;
  protected requireRequestSchema<TSchema extends z.ZodType>(
    schema: TSchema | undefined,
    requestPart: "body" | "header" | "param" | "query",
  ): TSchema;
  protected findMultiplicityIssues(
    data: unknown,
    schema: HttpHeaderSchemaLike | HttpQuerySchema,
    caseSensitive: boolean,
  ): z.core.$ZodIssue[];
  protected findRecordKeyIdentityIssues(
    data: unknown,
    schema: HttpHeaderSchemaLike | HttpQuerySchema,
  ): z.core.$ZodIssue[];
  protected coerceToSchema(
    data: unknown,
    shape: Record<string, unknown>,
    caseSensitive: boolean,
    preserveUnknownKeys: boolean,
  ): unknown;
  protected coerceHeaderToSchema(
    header: unknown,
    schema: HttpHeaderSchemaLike,
    preserveUnknownObjectKeys?: boolean,
  ): unknown;
  protected coerceQueryToSchema(query: unknown, schema: HttpQuerySchema): unknown;
}
import type { HttpHeaderSchemaLike, HttpQuerySchema } from "@rexeus/typeweaver-core";
import type { z } from "zod";
