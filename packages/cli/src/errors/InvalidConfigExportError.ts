import { Data } from "effect";

export type InvalidConfigExportReason =
  | "both-default-and-named-config"
  | "default-namespace-wrapper"
  | "missing-config-export"
  | "non-object-config";

export class InvalidConfigExportError extends Data.TaggedError(
  "InvalidConfigExportError"
)<{
  readonly configPath: string;
  readonly reason: InvalidConfigExportReason;
}> {
  public override get message(): string {
    switch (this.reason) {
      case "both-default-and-named-config":
        return `Configuration file '${this.configPath}' must choose one export style: use either 'export default' or 'export const config = ...', but not both.`;
      case "default-namespace-wrapper":
        return `Configuration file '${this.configPath}' default export must be the config object itself, not a module namespace-like wrapper. Export the config directly with 'export default { ... }' or use 'export const config = ...'.`;
      case "missing-config-export":
        return `Configuration file '${this.configPath}' must export its config via 'export default' or 'export const config = ...'.`;
      case "non-object-config":
        return `Configuration file '${this.configPath}' must export a config object via 'export default' or 'export const config = ...'.`;
    }
  }
}
