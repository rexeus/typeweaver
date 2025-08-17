import {
  HttpOperationDefinition,
  HttpResponseDefinition,
} from "@rexeus/typeweaver-core";
import type { IHttpResponseDefinition } from "@rexeus/typeweaver-core";
import { DuplicateOperationIdError } from "./errors/DuplicateOperationIdError";
import { DuplicateResponseNameError } from "./errors/DuplicateResponseNameError";
import { DuplicateRouteError } from "./errors/DuplicateRouteError";

export type RouteInfo = {
  readonly operationId: string;
  readonly file: string;
};

export class DefinitionRegistry {
  private readonly operationIds = new Map<string, string>();
  private readonly responseNames = new Map<string, string>();
  private readonly routes = new Map<string, RouteInfo>();

  public registerOperation(
    operation: HttpOperationDefinition<
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
    >,
    sourceFile: string
  ): void {
    // Check for duplicate operation ID
    const existingFile = this.operationIds.get(operation.operationId);
    if (existingFile) {
      throw new DuplicateOperationIdError(
        operation.operationId,
        existingFile,
        sourceFile
      );
    }
    this.operationIds.set(operation.operationId, sourceFile);

    // Register route
    const normalizedPath = this.normalizePath(operation.path);
    const routeKey = `${operation.method} ${normalizedPath}`;
    const existingRoute = this.routes.get(routeKey);

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

    this.routes.set(routeKey, {
      operationId: operation.operationId,
      file: sourceFile,
    });
  }

  public registerResponse(
    response:
      | IHttpResponseDefinition
      | HttpResponseDefinition<any, any, any, any, any, any>,
    sourceFile: string
  ): void {
    // Check for duplicate response name
    const existingFile = this.responseNames.get(response.name);
    if (existingFile) {
      throw new DuplicateResponseNameError(
        response.name,
        existingFile,
        sourceFile
      );
    }
    this.responseNames.set(response.name, sourceFile);
  }

  public hasOperationId(operationId: string): boolean {
    return this.operationIds.has(operationId);
  }

  public hasResponseName(name: string): boolean {
    return this.responseNames.has(name);
  }

  public hasRoute(method: string, path: string): boolean {
    const normalizedPath = this.normalizePath(path);
    const routeKey = `${method} ${normalizedPath}`;
    return this.routes.has(routeKey);
  }

  public getOperationFile(operationId: string): string | undefined {
    return this.operationIds.get(operationId);
  }

  public getResponseFile(name: string): string | undefined {
    return this.responseNames.get(name);
  }

  public getRouteInfo(method: string, path: string): RouteInfo | undefined {
    const normalizedPath = this.normalizePath(path);
    const routeKey = `${method} ${normalizedPath}`;
    return this.routes.get(routeKey);
  }

  private normalizePath(path: string): string {
    // Replace all :paramName patterns with position-based placeholders
    let paramIndex = 1;
    return path.replace(/:([a-zA-Z0-9_]+)/g, () => {
      return `:param${paramIndex++}`;
    });
  }
}
