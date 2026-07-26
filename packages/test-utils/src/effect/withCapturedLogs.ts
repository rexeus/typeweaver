import { Effect, Logger } from "effect";

export type CapturedLog = {
  readonly level: string;
  readonly message: string;
};

const renderMessage = (message: unknown): string => {
  if (Array.isArray(message)) {
    return message
      .map(part => (typeof part === "string" ? part : String(part)))
      .join(" ");
  }
  return typeof message === "string" ? message : String(message);
};

/**
 * Runs an Effect with a captured logger and returns the result alongside
 * the array of log lines emitted during execution.
 *
 * `Logger.replace` overrides the default logger for the scope of the
 * provided effect — production loggers (e.g. `CliLoggerLayer`) are
 * bypassed. Tests assert against the returned array instead of spying on
 * `console.*`, which keeps the assertion at Effect's logging surface and
 * sheds the global-mock boilerplate.
 *
 *   const { result, logs } = await Effect.runPromise(
 *     withCapturedLogs(myProgram)
 *   );
 *   expect(logs).toContainEqual({ level: "Info", message: "Hello" });
 */
export const withCapturedLogs = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<
  {
    readonly result: A;
    readonly logs: readonly CapturedLog[];
  },
  E,
  R
> =>
  Effect.gen(function* () {
    const logs: CapturedLog[] = [];
    const capturingLogger = Logger.make<unknown, void>(
      ({ message, logLevel }) => {
        logs.push({
          level: logLevel.label,
          message: renderMessage(message),
        });
      }
    );

    const result = yield* effect.pipe(
      Effect.provide(Logger.replace(Logger.defaultLogger, capturingLogger))
    );

    return { result, logs };
  });
