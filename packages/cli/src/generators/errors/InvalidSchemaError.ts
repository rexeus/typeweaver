export class InvalidSchemaError extends Error {
  public constructor(
    public readonly schemaType: "header" | "body" | "param" | "query",
    public readonly definitionName: string,
    public readonly context: "request" | "response" | "operation",
    public readonly file: string
  ) {
    const schemaRequirement =
      schemaType === "body"
        ? "Must be a Zod schema"
        : "Must be a Zod object schema";

    super(
      `Invalid ${schemaType} schema in ${context} '${definitionName}' at \`${file}\`. ${schemaRequirement}.`
    );
  }
}
