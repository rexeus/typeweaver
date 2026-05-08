export class UnsupportedTypeScriptConfigError extends Error {
  public override readonly name = "UnsupportedTypeScriptConfigError";

  public constructor(
    public readonly configPath: string,
    public readonly extension: string
  ) {
    super(
      `TypeScript config files are not supported: '${configPath}' uses '${extension}'. Use a JavaScript config file with one of these extensions: .js, .mjs, or .cjs.`
    );
  }
}
