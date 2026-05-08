export class MissingCanonicalResponseError extends Error {
  public override readonly name = "MissingCanonicalResponseError";

  public constructor(public readonly responseName: string) {
    super(
      `Missing canonical response '${responseName}' in the normalized spec.`
    );
  }
}
