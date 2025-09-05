import {
  HttpMethod,
  HttpOperationDefinition,
  HttpResponseDefinition,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";
import { z } from "zod";
import type { IHttpResponseDefinition } from "@rexeus/typeweaver-core";
import { DefinitionRegistry } from "./DefinitionRegistry";
import { EmptyResponseArrayError } from "./errors/EmptyResponseArrayError";
import { InvalidHttpMethodError } from "./errors/InvalidHttpMethodError";
import { InvalidPathParameterError } from "./errors/InvalidPathParameterError";
import { InvalidSchemaError } from "./errors/InvalidSchemaError";
import { InvalidSchemaShapeError } from "./errors/InvalidSchemaShapeError";
import { InvalidStatusCodeError } from "./errors/InvalidStatusCodeError";
import { MissingRequiredFieldError } from "./errors/MissingRequiredFieldError";

// Type aliases for better readability
type AnyHttpOperation = HttpOperationDefinition<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>;
type AnyHttpResponse =
  | IHttpResponseDefinition
  | HttpResponseDefinition<any, any, any, any, any, any>;

export class DefinitionValidator {
  private readonly registry: DefinitionRegistry;

  public constructor(registry?: DefinitionRegistry) {
    this.registry = registry ?? new DefinitionRegistry();
  }

  public validateOperation(
    operation: AnyHttpOperation,
    sourceFile: string
  ): void {
    // Register and check for duplicates
    this.registry.registerOperation(operation, sourceFile);

    // Validate required fields
    this.validateOperationRequiredFields(operation, sourceFile);

    // Validate HTTP method
    this.validateHttpMethod(operation, sourceFile);

    // Validate request schemas
    if (operation.request) {
      this.validateRequestSchemas(operation, sourceFile);
    }

    // Validate responses
    this.validateOperationResponses(operation, sourceFile);

    // Validate path parameters
    this.validatePathParameters(operation, sourceFile);
  }

  public validateResponse(response: AnyHttpResponse, sourceFile: string): void {
    // Register and check for duplicates
    this.registry.registerResponse(response, sourceFile);

    // Validate required fields
    this.validateResponseRequiredFields(response, sourceFile);

    // Validate status code
    this.validateStatusCode(response, sourceFile);

    // Validate schemas
    this.validateResponseSchemas(response, sourceFile);
  }

  private validateOperationRequiredFields(
    operation: AnyHttpOperation,
    sourceFile: string
  ): void {
    if (!operation.operationId) {
      throw new MissingRequiredFieldError(
        "operation",
        "unknown",
        "operationId",
        sourceFile
      );
    }

    if (!operation.path) {
      throw new MissingRequiredFieldError(
        "operation",
        operation.operationId,
        "path",
        sourceFile
      );
    }

    if (!operation.method) {
      throw new MissingRequiredFieldError(
        "operation",
        operation.operationId,
        "method",
        sourceFile
      );
    }

    if (!operation.summary) {
      throw new MissingRequiredFieldError(
        "operation",
        operation.operationId,
        "summary",
        sourceFile
      );
    }
  }

  private validateHttpMethod(
    operation: AnyHttpOperation,
    sourceFile: string
  ): void {
    const validMethods = Object.values(HttpMethod);
    if (!validMethods.includes(operation.method)) {
      throw new InvalidHttpMethodError(
        operation.operationId,
        operation.method,
        sourceFile
      );
    }
  }

  private validateRequestSchemas(
    operation: AnyHttpOperation,
    sourceFile: string
  ): void {
    const request = operation.request!;

    if (request.header) {
      this.validateSchema(
        request.header,
        "header",
        operation.operationId,
        "request",
        sourceFile
      );
    }

    if (request.query) {
      this.validateSchema(
        request.query,
        "query",
        operation.operationId,
        "request",
        sourceFile
      );
    }

    if (request.body) {
      this.validateSchema(
        request.body,
        "body",
        operation.operationId,
        "request",
        sourceFile
      );
    }

    if (request.param) {
      this.validateSchema(
        request.param,
        "param",
        operation.operationId,
        "request",
        sourceFile
      );
    }
  }

  private validateOperationResponses(
    operation: AnyHttpOperation,
    sourceFile: string
  ): void {
    if (!operation.responses || operation.responses.length === 0) {
      throw new EmptyResponseArrayError(operation.operationId, sourceFile);
    }

    // Validate responses within the operation
    for (const response of operation.responses) {
      // Skip validation of response references (already validated elsewhere)
      if (response instanceof HttpResponseDefinition) {
        continue;
      }
      this.validateResponse(response, sourceFile);
    }
  }

  private validateResponseRequiredFields(
    response: AnyHttpResponse,
    sourceFile: string
  ): void {
    if (!response.name) {
      throw new MissingRequiredFieldError(
        "response",
        "unknown",
        "name",
        sourceFile
      );
    }

    if (response.statusCode === undefined || response.statusCode === null) {
      throw new MissingRequiredFieldError(
        "response",
        response.name,
        "statusCode",
        sourceFile
      );
    }

    if (!response.description) {
      throw new MissingRequiredFieldError(
        "response",
        response.name,
        "description",
        sourceFile
      );
    }
  }

  private validateStatusCode(
    response: AnyHttpResponse,
    sourceFile: string
  ): void {
    const validStatusCodes = Object.values(HttpStatusCode);
    if (!validStatusCodes.includes(response.statusCode)) {
      throw new InvalidStatusCodeError(
        response.statusCode,
        response.name,
        sourceFile
      );
    }
  }

  private validateResponseSchemas(
    response: AnyHttpResponse,
    sourceFile: string
  ): void {
    if (response.header) {
      this.validateSchema(
        response.header,
        "header",
        response.name,
        "response",
        sourceFile
      );
    }

    if (response.body) {
      this.validateSchema(
        response.body,
        "body",
        response.name,
        "response",
        sourceFile
      );
    }
  }

  private validateSchema(
    schema: any,
    schemaType: "header" | "body" | "param" | "query",
    definitionName: string,
    context: "request" | "response",
    sourceFile: string
  ): void {
    // For body schemas, any ZodType is valid
    if (schemaType === "body") {
      if (!(schema instanceof z.ZodType)) {
        throw new InvalidSchemaError(
          schemaType,
          definitionName,
          context,
          sourceFile
        );
      }
      return;
    }

    // For header, query, and param schemas, must be ZodObject
    if (!(schema instanceof z.ZodObject)) {
      throw new InvalidSchemaError(
        schemaType,
        definitionName,
        context,
        sourceFile
      );
    }

    // Validate the shape based on schema type
    if (schemaType === "param") {
      this.validateParamShape(schema, definitionName, sourceFile);
    } else {
      this.validateHeaderOrQueryShape(
        schema,
        schemaType as "header" | "query",
        definitionName,
        context,
        sourceFile
      );
    }
  }

  private validatePathParameters(
    operation: AnyHttpOperation,
    sourceFile: string
  ): void {
    // Extract path parameters from the path
    const pathParamMatches = operation.path.matchAll(/:([a-zA-Z0-9_]+)/g);
    const pathParamsSet = new Set<string>();

    for (const match of pathParamMatches) {
      const paramName = match[1];

      // Check for duplicate parameter names within the path
      if (pathParamsSet.has(paramName)) {
        throw new InvalidPathParameterError(
          operation.operationId,
          operation.path,
          `Duplicate parameter name '${paramName}' in path`,
          sourceFile
        );
      }
      pathParamsSet.add(paramName);
    }

    // Get param schema if it exists
    const paramSchema = operation.request?.param;

    if (pathParamsSet.size > 0 && !paramSchema) {
      throw new InvalidPathParameterError(
        operation.operationId,
        operation.path,
        `Path contains parameters [${Array.from(pathParamsSet).join(", ")}] but request.param is not defined`,
        sourceFile
      );
    }

    if (paramSchema && paramSchema instanceof z.ZodObject) {
      const paramShape = paramSchema.shape;
      const paramKeys = new Set(Object.keys(paramShape));

      // Check that all path params are defined in the schema
      for (const pathParam of pathParamsSet) {
        if (!paramKeys.has(pathParam)) {
          throw new InvalidPathParameterError(
            operation.operationId,
            operation.path,
            `Path parameter ':${pathParam}' is not defined in request.param`,
            sourceFile
          );
        }
      }

      // Check that all schema params exist in the path
      for (const paramKey of paramKeys) {
        if (!pathParamsSet.has(paramKey)) {
          throw new InvalidPathParameterError(
            operation.operationId,
            operation.path,
            `Parameter '${paramKey}' is defined in request.param but not used in the path`,
            sourceFile
          );
        }
      }
    }
  }

  private validateHeaderOrQueryShape(
    schema: z.ZodObject<any>,
    schemaType: "header" | "query",
    definitionName: string,
    context: "request" | "response",
    sourceFile: string
  ): void {
    const shape = schema.shape;

    for (const [propName, propSchema] of Object.entries(shape)) {
      if (!this.isValidHeaderOrQueryValue(propSchema)) {
        const typeName = this.getZodTypeName(propSchema);
        throw new InvalidSchemaShapeError(
          schemaType,
          definitionName,
          context,
          propName,
          typeName,
          sourceFile
        );
      }
    }
  }

  private validateParamShape(
    schema: z.ZodObject<any>,
    operationId: string,
    sourceFile: string
  ): void {
    const shape = schema.shape;

    for (const [propName, propSchema] of Object.entries(shape)) {
      if (!this.isValidParamValue(propSchema)) {
        const typeName = this.getZodTypeName(propSchema);
        throw new InvalidSchemaShapeError(
          "param",
          operationId,
          "request",
          propName,
          typeName,
          sourceFile
        );
      }
    }
  }

  private isValidHeaderOrQueryValue(schema: any): boolean {
    // Check if it's a base string type
    if (this.isStringBasedType(schema)) {
      return true;
    }

    // Check if it's an optional of a valid type
    if (schema instanceof z.ZodOptional) {
      return this.isValidHeaderOrQueryValue(schema.unwrap());
    }

    // Check if it's an array of valid types
    if (schema instanceof z.ZodArray) {
      return this.isStringBasedType(schema.element);
    }

    return false;
  }

  private isValidParamValue(schema: any): boolean {
    // Check if it's a base string type
    if (this.isStringBasedType(schema)) {
      return true;
    }

    // Check if it's an optional of a valid type
    if (schema instanceof z.ZodOptional) {
      return this.isStringBasedType(schema.unwrap());
    }

    // No arrays allowed for params
    return false;
  }

  private isStringBasedType(schema: any): boolean {
    // Check if it's a string or string format (email, uuid, ulid, etc.)
    if (schema instanceof z.ZodString) {
      return true;
    }

    // Check if it's a string literal
    if (schema instanceof z.ZodLiteral && typeof schema.value === "string") {
      return true;
    }

    // Check if it's an enum (which contains string values)
    if (schema instanceof z.ZodEnum) {
      return true;
    }

    // Check for string format validators like ULID, UUID, Email, etc.
    // These are subclasses of ZodString but might have different constructor names
    const typeName = schema.constructor.name;
    const stringFormatTypes = [
      "ZodULID",
      "ZodUUID",
      "ZodUUIDv4",
      "ZodUUIDv7",
      "ZodUUIDv8",
      "ZodEmail",
      "ZodURL",
      "ZodCUID",
      "ZodCUID2",
      "ZodNanoID",
      "ZodBase64",
      "ZodBase64URL",
      "ZodEmoji",
      "ZodIPv4",
      "ZodIPv6",
      "ZodCIDRv4",
      "ZodCIDRv6",
      "ZodE164",
      "ZodJWT",
      "ZodASCII",
      "ZodUTF8",
      "ZodLowercase",
      "ZodGUID",
      "ZodISODate",
      "ZodISOTime",
      "ZodISODateTime",
      "ZodISODuration",
    ];

    if (stringFormatTypes.includes(typeName)) {
      return true;
    }

    // Check if it has a string-like type in the internal structure
    if (
      schema._def &&
      schema._def.typeName &&
      schema._def.typeName.includes("String")
    ) {
      return true;
    }

    return false;
  }

  private getZodTypeName(schema: any): string {
    // Return the constructor name directly for more specific type names
    const typeName = schema.constructor.name;

    // For optional and array types, show the inner type
    if (schema instanceof z.ZodOptional) {
      return `ZodOptional<${this.getZodTypeName(schema.unwrap())}>`;
    }
    if (schema instanceof z.ZodArray) {
      return `ZodArray<${this.getZodTypeName(schema.element)}>`;
    }

    // For literals, show the value type
    if (schema instanceof z.ZodLiteral) {
      return `ZodLiteral<${typeof schema.value}>`;
    }

    // Return the type name (e.g., ZodString, ZodULID, ZodEmail, etc.)
    return typeName;
  }

  public getRegistry(): DefinitionRegistry {
    return this.registry;
  }
}
