export class InvalidResourceNameError extends Error {
  public constructor(resourceName: string) {
    super(
      `Resource name '${resourceName}' is invalid. Use camelCase singular nouns when possible; PascalCase is also supported. snake_case and kebab-case are not supported.`
    );
    this.name = "InvalidResourceNameError";
  }
}
