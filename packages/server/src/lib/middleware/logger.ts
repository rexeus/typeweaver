import { defineMiddleware } from "../TypedMiddleware.js";

export type LogData = {
  readonly method: string;
  readonly path: string;
  readonly statusCode: number;
  readonly durationMs: number;
};

export type LoggerOptions = {
  readonly logFn?: (message: string) => void;
  readonly format?: (data: LogData) => string;
  readonly nowMs?: () => number;
};

const defaultFormat = (data: LogData): string =>
  `${data.method} ${data.path} ${data.statusCode} ${data.durationMs}ms`;

export function logger(options?: LoggerOptions) {
  const logFn = options?.logFn ?? console.log;
  const format = options?.format ?? defaultFormat;
  const nowMs = options?.nowMs ?? (() => performance.now());

  return defineMiddleware(async (ctx, next) => {
    const start = nowMs();
    const response = await next();
    const durationMs = Math.round(nowMs() - start);

    logFn(
      format({
        method: ctx.request.method,
        path: ctx.request.path,
        statusCode: response.statusCode,
        durationMs,
      }),
    );

    return response;
  });
}
