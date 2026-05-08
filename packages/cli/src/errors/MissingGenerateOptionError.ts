export class MissingGenerateOptionError extends Error {
  public override readonly name = "MissingGenerateOptionError";

  public constructor(
    public readonly optionName: string,
    public readonly flag: string,
    public readonly configKey: string
  ) {
    super(
      `Missing required generate option '${optionName}'. Pass ${flag} or set '${configKey}' in the TypeWeaver config file.`
    );
  }
}
