import { Data } from "effect";

/**
 * Raised synchronously by a plugin constructor when its options fail
 * validation. Construction happens at composition time — before the
 * Effect lifecycle starts and before the plugin participates in the
 * registry — so the throw is sync rather than an Effect failure.
 *
 * The `PluginLoader` recognises the tag and surfaces a
 * `PluginConfigError` directly to the CLI boundary instead of folding
 * the message into a generic `PluginLoadError`, preserving the
 * "this is a misconfiguration, not a load failure" distinction.
 */
export class PluginConfigError extends Data.TaggedError("PluginConfigError")<{
  readonly pluginName: string;
  readonly reason: string;
}> {
  public override get message(): string {
    return `Plugin '${this.pluginName}' is misconfigured: ${this.reason}`;
  }
}
