type SchemaInfo = {
  readonly originalKey: string;
  readonly isArray: boolean;
};

export declare abstract class Validator {
  protected analyzeSchema(
    shape: Record<string, unknown>,
    caseSensitive: boolean,
  ): Map<string, SchemaInfo>;
  protected getSchema(headerSchema: unknown): Record<string, unknown>;
  protected coerceToSchema(
    data: unknown,
    shape: Record<string, unknown>,
    caseSensitive: boolean,
  ): unknown;
  protected coerceHeaderToSchema(
    header: unknown,
    shape: Record<string, unknown>,
  ): unknown;
  protected coerceQueryToSchema(
    query: unknown,
    shape: Record<string, unknown>,
  ): unknown;
}
