import { Data } from "effect";

export class UnsupportedConfigExtensionError extends Data.TaggedError(
  "UnsupportedConfigExtensionError"
)<{
  readonly configPath: string;
  readonly extension: string;
  readonly supportedExtensions: readonly string[];
}> {
  public override get message(): string {
    return `Unsupported config file extension '${this.extension}' for '${this.configPath}'. TypeWeaver accepts only these config extensions: ${this.supportedExtensions.join(", ")}.`;
  }
}
