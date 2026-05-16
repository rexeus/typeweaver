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
 * the CLI has emitted since the imperative-runtime days, while routing
 * everything through Effect's logging surface so tests can capture log
 * lines without spying on `console.*`.
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
 * Layer that replaces Effect's default logger with `cliLogger`. Apply via
 * `Layer.provide` (or merge into the production layer) anywhere the
 * friendly CLI logging is desired.
 */
export const CliLoggerLayer = Logger.replace(Logger.defaultLogger, cliLogger);
