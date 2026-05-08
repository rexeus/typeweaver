export class UnsupportedConfigExtensionError extends Error {
  public override readonly name = "UnsupportedConfigExtensionError";

  public constructor(
    public readonly configPath: string,
    public readonly extension: string,
    public readonly supportedExtensions: readonly string[]
  ) {
    super(
      `Unsupported config file extension '${extension}' for '${configPath}'. TypeWeaver accepts only these config extensions: ${supportedExtensions.join(", ")}.`
    );
  }
}
