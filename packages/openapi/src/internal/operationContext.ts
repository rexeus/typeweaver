import type { NormalizedOperation } from "@rexeus/typeweaver-gen";
import type { OpenApiWarningLocation } from "../types.js";

export type OperationContext = {
  readonly resourceName: string;
  readonly operation: Pick<
    NormalizedOperation,
    "operationId" | "path" | "request"
  > & { readonly method: string };
  readonly openApiPath: string;
  readonly method: string;
};

export function createOperationLocation(options: {
  readonly context: OperationContext;
  readonly part: string;
  readonly parameterName?: string;
  readonly responseName?: string;
  readonly statusCode?: string;
}): OpenApiWarningLocation {
  return {
    resourceName: options.context.resourceName,
    operationId: options.context.operation.operationId,
    method: options.context.operation.method,
    path: options.context.operation.path,
    openApiPath: options.context.openApiPath,
    part: options.part,
    parameterName: options.parameterName,
    responseName: options.responseName,
    statusCode: options.statusCode,
  };
}
