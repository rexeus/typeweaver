export type PluginLoadError = {
  readonly pluginName: string;
  readonly attempts: readonly {
    readonly path: string;
    readonly error: string;
  }[];
};

export class PluginLoadingFailure extends Error implements PluginLoadError {
  public constructor(
    public readonly pluginName: string,
    public readonly attempts: readonly {
      readonly path: string;
      readonly error: string;
    }[]
  ) {
    super(`Failed to load plugin '${pluginName}'`);
    Object.setPrototypeOf(this, PluginLoadingFailure.prototype);
  }
}
