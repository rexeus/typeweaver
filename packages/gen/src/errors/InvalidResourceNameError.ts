import { Data } from "effect";

export class InvalidResourceNameError extends Data.TaggedError(
  "InvalidResourceNameError"
)<{
  readonly resourceName: string;
}> {
  public override get message(): string {
    return `Resource name '${this.resourceName}' is invalid. Use camelCase singular nouns when possible; PascalCase is also supported. snake_case and kebab-case are not supported.`;
  }
}
