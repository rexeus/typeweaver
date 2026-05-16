import { Data } from "effect";

export class PathParameterMismatchError extends Data.TaggedError(
  "PathParameterMismatchError"
)<{
  readonly operationId: string;
  readonly path: string;
  readonly pathParams: readonly string[];
  readonly requestParams: readonly string[];
}> {
  public override get message(): string {
    return `Operation '${this.operationId}' has mismatched path parameters for '${this.path}'. Path params: [${this.pathParams.join(
      ", "
    )}], request.param keys: [${this.requestParams.join(", ")}].`;
  }
}
