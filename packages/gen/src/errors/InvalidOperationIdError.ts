import { Data } from "effect";

export class InvalidOperationIdError extends Data.TaggedError(
  "InvalidOperationIdError"
)<{
  readonly operationId: string;
}> {
  public override get message(): string {
    return `Operation ID '${this.operationId}' is invalid. Use camelCase (preferred) or PascalCase. snake_case and kebab-case are not supported.`;
  }
}
