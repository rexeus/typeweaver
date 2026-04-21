export class ReservedPluginOutputDirectoryError extends Error {
  public constructor(
    public readonly pluginName: string,
    public readonly directory: string
  ) {
    super(
      `Plugin name '${pluginName}' conflicts with a reserved output directory.\n` +
        `  Directory: \`${directory}\`\n` +
        `  Typeweaver uses this directory for shared output (spec, lib, responses); a plugin cannot emit into it.\n` +
        `  Rename the plugin to resolve the conflict.`
    );
  }
}
