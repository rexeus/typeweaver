import { Data } from "effect";

export class SpecBundleOutputMissingError extends Data.TaggedError(
  "SpecBundleOutputMissingError"
)<{
  readonly inputFile: string;
  readonly bundledSpecFile: string;
  readonly specOutputDir: string;
}> {
  public override get message(): string {
    return `Spec bundling completed but did not create the expected output '${this.bundledSpecFile}' for entrypoint '${this.inputFile}'. Expected the bundle inside '${this.specOutputDir}'.`;
  }
}
