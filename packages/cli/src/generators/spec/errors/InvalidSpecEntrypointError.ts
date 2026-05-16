import { Data } from "effect";

export class InvalidSpecEntrypointError extends Data.TaggedError(
  "InvalidSpecEntrypointError"
)<{
  readonly specEntrypoint: string;
}> {
  public override get message(): string {
    return `Spec entrypoint '${this.specEntrypoint}' must export a SpecDefinition as its default export, named 'spec' export, or module namespace.`;
  }
}
