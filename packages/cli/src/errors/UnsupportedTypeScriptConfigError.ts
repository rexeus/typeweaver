import { Data } from "effect";

export class UnsupportedTypeScriptConfigError extends Data.TaggedError(
  "UnsupportedTypeScriptConfigError"
)<{
  readonly configPath: string;
  readonly extension: string;
}> {
  public override get message(): string {
    return `TypeScript config files are not supported: '${this.configPath}' uses '${this.extension}'. Use a JavaScript config file with one of these extensions: .js, .mjs, or .cjs.`;
  }
}
