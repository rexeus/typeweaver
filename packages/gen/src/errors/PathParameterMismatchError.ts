export class PathParameterMismatchError extends Error {
  public constructor(
    operationId: string,
    path: string,
    pathParams: readonly string[],
    requestParams: readonly string[]
  ) {
    super(
      `Operation '${operationId}' has mismatched path parameters for '${path}'. Path params: [${pathParams.join(
        ", "
      )}], request.param keys: [${requestParams.join(", ")}].`
    );
    this.name = "PathParameterMismatchError";
  }
}
