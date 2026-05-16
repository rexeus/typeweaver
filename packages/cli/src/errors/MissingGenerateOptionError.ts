import { Data } from "effect";

export class MissingGenerateOptionError extends Data.TaggedError(
  "MissingGenerateOptionError"
)<{
  readonly optionName: string;
  readonly flag: string;
  readonly configKey: string;
}> {
  public override get message(): string {
    return `Missing required generate option '${this.optionName}'. Pass ${this.flag} or set '${this.configKey}' in the TypeWeaver config file.`;
  }
}
