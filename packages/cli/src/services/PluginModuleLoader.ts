import { Data, Effect } from "effect";

/**
 * Failure raised when a plugin module specifier cannot be resolved or
 * loaded. The original `cause` is preserved for diagnostic purposes.
 */
export class PluginModuleNotFoundError extends Data.TaggedError(
  "PluginModuleNotFoundError"
)<{
  readonly specifier: string;
  readonly cause: unknown;
}> {
  public override get message(): string {
    const causeMessage =
      this.cause instanceof Error ? this.cause.message : String(this.cause);
    return `Failed to load plugin module '${this.specifier}': ${causeMessage}`;
  }
}

/**
 * Resolves and dynamically imports plugin modules.
 *
 * The default implementation delegates to Node's `import(specifier)`; tests
 * substitute a layer that resolves specifiers to in-memory module records,
 * eliminating the need to materialize plugin source on disk.
 */
export class PluginModuleLoader extends Effect.Service<PluginModuleLoader>()(
  "typeweaver/PluginModuleLoader",
  {
    succeed: {
      load: (
        specifier: string
      ): Effect.Effect<Record<string, unknown>, PluginModuleNotFoundError> =>
        Effect.tryPromise({
          try: async () => (await import(specifier)) as Record<string, unknown>,
          catch: cause => new PluginModuleNotFoundError({ specifier, cause }),
        }),
    },
    accessors: true,
  }
) {}
