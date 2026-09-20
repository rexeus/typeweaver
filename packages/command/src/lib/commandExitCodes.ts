export const COMMAND_EXIT_CODES = Object.freeze({
  success: 0,
  usage: 2,
  validation: 3,
  http: 4,
  network: 5,
  internal: 6,
  cancelled: 130,
});

export class CommandUsageError extends Error {
  public override readonly name = "CommandUsageError";
}
