export class InvalidSpecEntrypointError extends Error {
  public constructor(specEntrypoint: string) {
    super(
      `Spec entrypoint '${specEntrypoint}' must export a SpecDefinition as its default export, named 'spec' export, or module namespace.`
    );
    this.name = "InvalidSpecEntrypointError";
  }
}
