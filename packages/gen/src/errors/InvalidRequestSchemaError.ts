import type { NormalizedRequest } from "../NormalizedSpec.js";

export class InvalidRequestSchemaError extends Error {
  public constructor(
    operationId: string,
    requestPart: keyof NormalizedRequest
  ) {
    super(
      `Operation '${operationId}' has an invalid request.${requestPart} schema definition.`
    );
    this.name = "InvalidRequestSchemaError";
  }
}
