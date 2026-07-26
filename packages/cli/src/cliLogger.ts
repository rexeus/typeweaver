import { Logger } from "effect";

const renderMessage = (message: unknown): string => {
  if (Array.isArray(message)) {
    return message
      .map(part => (typeof part === "string" ? part : String(part)))
      .join(" ");
  }
  return typeof message === "string" ? message : String(message);
};

/**
 * Friendly CLI logger: drops timestamps and the `level=` prefix; only
 * tags warnings and errors. Mirrors the bare-line `console.log` output
 * the CLI has emitted since the imperative-runtime days.
 *
 * Adapter unit tests target the `console` boundary via `vi.spyOn(console, ...)`.
 * Consumer-code tests should provide a capturing logger layer
 * (`withCapturedLogs`) and assert on captured records instead.
 */
export const cliLogger = Logger.make<unknown, void>(({ message, logLevel }) => {
  const text = renderMessage(message);

  switch (logLevel._tag) {
    case "Warning":
      // eslint-disable-next-line no-console
      console.warn(`[WARN] ${text}`);
      return;
    case "Error":
    case "Fatal":
      // eslint-disable-next-line no-console
      console.error(`[ERROR] ${text}`);
      return;
    default:
      // eslint-disable-next-line no-console
      console.info(text);
      return;
  }
});

/**
 * Verbose flavor of `cliLogger`: same shape, but tags Debug records with
 * a `[DEBUG]` prefix so they are visually distinct from the bare-line
 * Info output. Paired with `Logger.minimumLogLevel(LogLevel.Debug)` in
 * `VerboseLayer` so `Effect.logDebug(...)` calls actually reach the
 * console.
 */
export const verboseCliLogger = Logger.make<unknown, void>(
  ({ message, logLevel }) => {
    const text = renderMessage(message);

    switch (logLevel._tag) {
      case "Warning":
        // eslint-disable-next-line no-console
        console.warn(`[WARN] ${text}`);
        return;
      case "Error":
      case "Fatal":
        // eslint-disable-next-line no-console
        console.error(`[ERROR] ${text}`);
        return;
      case "Debug":
      case "Trace":
        // eslint-disable-next-line no-console
        console.info(`[DEBUG] ${text}`);
        return;
      default:
        // eslint-disable-next-line no-console
        console.info(text);
        return;
    }
  }
);

/**
 * Layer that replaces Effect's default logger with `cliLogger`. Apply via
 * `Layer.provide` (or merge into the production layer) anywhere the
 * friendly CLI logging is desired.
 */
export const CliLoggerLayer = Logger.replace(Logger.defaultLogger, cliLogger);

/**
 * Verbose variant of `CliLoggerLayer`. Used by `VerboseLayer` so the
 * `[DEBUG]` records emitted from high-value seams reach the console
 * instead of being dropped or rendered with the platform's pretty
 * formatter.
 */
export const VerboseCliLoggerLayer = Logger.replace(
  Logger.defaultLogger,
  verboseCliLogger
);
