import {
  HttpMethod,
  HttpOperationDefinition,
  HttpResponseDefinition,
  HttpStatusCode,
  type IHttpResponseDefinition,
} from "@rexeus/typeweaver-core";
import { z } from "zod/v4";
import { DuplicateOperationIdError } from "./errors/DuplicateOperationIdError";
import { DuplicateResponseNameError } from "./errors/DuplicateResponseNameError";
import { InvalidPathParameterError } from "./errors/InvalidPathParameterError";
import { MissingRequiredFieldError } from "./errors/MissingRequiredFieldError";
import { InvalidHttpMethodError } from "./errors/InvalidHttpMethodError";
import { EmptyResponseArrayError } from "./errors/EmptyResponseArrayError";
import { DuplicateRouteError } from "./errors/DuplicateRouteError";

export type ValidationState = {
  operationIds: Map<string, string>; // operationId -> file path
  responseNames: Map<string, string>; // response name -> file path
  routes: Map<string, { operationId: string; file: string }>; // "METHOD /path" -> { operationId, file }
};

export class DefinitionValidator {
  private readonly state: ValidationState;

  public constructor(state?: ValidationState) {
    this.state = state ?? {
      operationIds: new Map(),
      responseNames: new Map(),
      routes: new Map(),
    };
  }

  public validateOperation(
    operation: HttpOperationDefinition<any, any, any, any, any, any, any, any, any, any>,
    sourceFile: string
  ): void {
    // Check for duplicate operation ID
    const existingFile = this.state.operationIds.get(operation.operationId);
    if (existingFile) {
      throw new DuplicateOperationIdError(
        operation.operationId,
        existingFile,
        sourceFile
      );
    }
    this.state.operationIds.set(operation.operationId, sourceFile);

    // Validate required fields
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

    // Validate HTTP method
    const validMethods = Object.values(HttpMethod);
    if (!validMethods.includes(operation.method)) {
      throw new InvalidHttpMethodError(
        operation.operationId,
        operation.method,
        sourceFile
      );
    }

    // Validate responses array
    if (!operation.responses || operation.responses.length === 0) {
      throw new EmptyResponseArrayError(operation.operationId, sourceFile);
    }

    // Validate path parameters
    this.validatePathParameters(operation, sourceFile);

    // Check for duplicate routes
    const routeKey = `${operation.method} ${operation.path}`;
    const existingRoute = this.state.routes.get(routeKey);
    if (existingRoute) {
      throw new DuplicateRouteError(
        operation.path,
        operation.method,
        existingRoute.operationId,
        existingRoute.file,
        operation.operationId,
        sourceFile
      );
    }
    this.state.routes.set(routeKey, {
      operationId: operation.operationId,
      file: sourceFile,
    });

    // Validate responses within the operation
    for (const response of operation.responses) {
      // Skip validation of response references (already validated elsewhere)
      if (response instanceof HttpResponseDefinition) {
        continue;
      }
      this.validateResponse(response, sourceFile);
    }
  }

  public validateResponse(
    response: IHttpResponseDefinition | HttpResponseDefinition<any, any, any, any, any, any>,
    sourceFile: string
  ): void {
    // Check for duplicate response name
    const existingFile = this.state.responseNames.get(response.name);
    if (existingFile) {
      throw new DuplicateResponseNameError(
        response.name,
        existingFile,
        sourceFile
      );
    }
    this.state.responseNames.set(response.name, sourceFile);

    // Validate required fields
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

    // Validate status code
    const validStatusCodes = Object.values(HttpStatusCode);
    if (!validStatusCodes.includes(response.statusCode)) {
      throw new Error(
        `Invalid status code '${response.statusCode}' in response '${response.name}' at ${sourceFile}`
      );
    }

    // Validate schemas if present
    if (response.header && !(response.header instanceof z.ZodType)) {
      throw new Error(
        `Invalid header schema in response '${response.name}' at ${sourceFile}. Must be a Zod schema.`
      );
    }

    if (response.body && !(response.body instanceof z.ZodType)) {
      throw new Error(
        `Invalid body schema in response '${response.name}' at ${sourceFile}. Must be a Zod schema.`
      );
    }
  }

  private validatePathParameters(
    operation: HttpOperationDefinition<any, any, any, any, any, any, any, any, any, any>,
    sourceFile: string
  ): void {
    // Extract path parameters from the path
    const pathParamMatches = operation.path.matchAll(/:([a-zA-Z0-9_]+)/g);
    const pathParams = new Set<string>();
    for (const match of pathParamMatches) {
      pathParams.add(match[1]);
    }

    // Get param schema if it exists
    const paramSchema = operation.request?.param;
    
    if (pathParams.size > 0 && !paramSchema) {
      throw new InvalidPathParameterError(
        operation.operationId,
        operation.path,
        `Path contains parameters [${Array.from(pathParams).join(", ")}] but request.param is not defined`,
        sourceFile
      );
    }

    if (paramSchema) {
      // Validate that param schema is a Zod object
      if (!(paramSchema instanceof z.ZodObject)) {
        throw new InvalidPathParameterError(
          operation.operationId,
          operation.path,
          "request.param must be a Zod object schema",
          sourceFile
        );
      }

      const paramShape = paramSchema.shape;
      const paramKeys = new Set(Object.keys(paramShape));

      // Check that all path params are defined in the schema
      for (const pathParam of pathParams) {
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
        if (!pathParams.has(paramKey)) {
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

  public getState(): ValidationState {
    return this.state;
  }
}