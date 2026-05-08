export class SpecBundleOutputMissingError extends Error {
  public override readonly name = "SpecBundleOutputMissingError";

  public constructor(
    public readonly inputFile: string,
    public readonly bundledSpecFile: string,
    public readonly specOutputDir: string
  ) {
    super(
      `Spec bundling completed but did not create the expected output '${bundledSpecFile}' for entrypoint '${inputFile}'. Expected the bundle inside '${specOutputDir}'.`
    );
  }
}
