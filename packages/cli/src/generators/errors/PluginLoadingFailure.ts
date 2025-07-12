export type PluginLoadError = {
  readonly pluginName: string;
  readonly attempts: Array<{
    readonly path: string;
    readonly error: string;
  }>;
};

export class PluginLoadingFailure extends Error implements PluginLoadError {
  public constructor(
    public readonly pluginName: string,
    public readonly attempts: Array<{ path: string; error: string }>
  ) {
    super(`Failed to load plugin '${pluginName}'`);

    // Set the prototype explicitly for better stack traces
    Object.setPrototypeOf(this, PluginLoadingFailure.prototype);
  }
}
