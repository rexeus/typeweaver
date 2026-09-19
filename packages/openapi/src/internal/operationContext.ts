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
  readonly parameterName?: string | undefined;
  readonly responseName?: string | undefined;
  readonly statusCode?: string | undefined;
}): OpenApiWarningLocation {
  const isComponentResponseLocation =
    options.context.resourceName === "components.responses";

  return {
    resourceName: options.context.resourceName,
    operationId: options.context.operation.operationId,
    ...(isComponentResponseLocation
      ? {}
      : {
          method: options.context.operation.method,
          path: options.context.operation.path,
        }),
    openApiPath: options.context.openApiPath,
    part: options.part,
    ...(options.parameterName === undefined
      ? {}
      : { parameterName: options.parameterName }),
    ...(options.responseName === undefined
      ? {}
      : { responseName: options.responseName }),
    ...(options.statusCode === undefined
      ? {}
      : { statusCode: options.statusCode }),
  };
}
