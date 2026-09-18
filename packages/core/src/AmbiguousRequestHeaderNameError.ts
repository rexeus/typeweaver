export class AmbiguousRequestHeaderNameError extends Error {
  public readonly firstName: string;
  public readonly secondName: string;

  public constructor(firstName: string, secondName: string) {
    super(
      `Request header names '${firstName}' and '${secondName}' collide case-insensitively`
    );
    this.name = "AmbiguousRequestHeaderNameError";
    this.firstName = firstName;
    this.secondName = secondName;
  }
}
