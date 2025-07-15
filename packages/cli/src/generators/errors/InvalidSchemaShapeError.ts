export class InvalidSchemaShapeError extends Error {
  public constructor(
    public readonly schemaType: "header" | "param" | "query",
    public readonly definitionName: string,
    public readonly context: "request" | "response",
    public readonly propertyName: string,
    public readonly invalidType: string,
    public readonly file: string
  ) {
    const allowedTypes = 
      schemaType === "param" 
        ? "string-based types (ZodString, ZodLiteral<string>, ZodEnum) or ZodOptional of these types"
        : "string-based types (ZodString, ZodLiteral<string>, ZodEnum), ZodOptional, or ZodArray of these types";
    
    super(
      `Invalid ${schemaType} schema shape in ${context} '${definitionName}' at \`${file}\`\n` +
      `  Property '${propertyName}' has invalid type: ${invalidType}\n` +
      `  Allowed types: ${allowedTypes}`
    );
  }
}