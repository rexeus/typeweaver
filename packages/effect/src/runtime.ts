import type { IHttpRequest, IHttpResponse } from "@rexeus/typeweaver-core";
import {
  Cause,
  Chunk,
  Effect,
  Exit,
  Layer,
  ManagedRuntime,
  Option,
} from "effect";

export type EffectHandlerRoute = {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
};

export type EffectHandlerContext = {
  readonly signal: AbortSignal;
  readonly route: EffectHandlerRoute | undefined;
};

export type EffectRequestHandler<
  TRequest extends IHttpRequest,
  TResponse extends IHttpResponse,
  TError,
  TRequirements,
  TContext extends EffectHandlerContext = EffectHandlerContext,
> = (
  request: TRequest,
  context: TContext
) => Effect.Effect<TResponse, TError, TRequirements>;

export type EffectHandlerErrorMapper<
  TError,
  TResponse extends IHttpResponse,
  TContext extends EffectHandlerContext = EffectHandlerContext,
> = (error: TError, context: TContext) => TResponse | Promise<TResponse>;

type RuntimeRouteMetadata = {
  readonly operationId: string;
  readonly method: string;
  readonly path: string;
};

const routeMetadata = (
  context: EffectHandlerContext
): RuntimeRouteMetadata => ({
  operationId: context.route?.operationId ?? "unknown-operation",
  method: context.route?.method ?? "UNKNOWN",
  path: context.route?.path ?? "unknown-route",
});

export class EffectHandlerDefectError extends Error {
  public readonly _tag = "EffectHandlerDefectError";
  public readonly operationId: string;

  public constructor(operationId: string, cause: unknown) {
    super(`Effect handler '${operationId}' failed unexpectedly.`, { cause });
    this.name = "EffectHandlerDefectError";
    this.operationId = operationId;
  }
}

export class EffectHandlerInterruptedError extends Error {
  public readonly _tag = "EffectHandlerInterruptedError";
  public readonly operationId: string;

  public constructor(operationId: string, cause: unknown) {
    super(`Effect handler '${operationId}' was interrupted.`, { cause });
    this.name = "EffectHandlerInterruptedError";
    this.operationId = operationId;
  }
}

export type EffectHandlerRuntime<TRequirements> = {
  readonly run: <
    TRequest extends IHttpRequest,
    TResponse extends IHttpResponse,
    TError,
    TContext extends EffectHandlerContext,
  >(
    handler: EffectRequestHandler<
      TRequest,
      TResponse,
      TError,
      TRequirements,
      TContext
    >,
    request: TRequest,
    context: TContext,
    mapError: EffectHandlerErrorMapper<TError, TResponse, TContext>
  ) => Promise<TResponse>;
  readonly dispose: () => Promise<void>;
};

export const createEffectHandlerRuntime = <TRequirements>(
  layer: Layer.Layer<TRequirements, never, never>
): EffectHandlerRuntime<TRequirements> => {
  const runtime = ManagedRuntime.make(layer);
  let disposal: Promise<void> | undefined;

  return {
    run: async (handler, request, context, mapError) => {
      const metadata = routeMetadata(context);
      const program = handler(request, context).pipe(
        Effect.annotateLogs({
          "typeweaver.operationId": metadata.operationId,
          "http.request.method": metadata.method,
          "http.route": metadata.path,
        }),
        Effect.withSpan(`typeweaver.handler.${metadata.operationId}`, {
          attributes: {
            "typeweaver.operationId": metadata.operationId,
            "http.request.method": metadata.method,
            "http.route": metadata.path,
          },
          kind: "server",
        })
      );
      const exit = await runtime.runPromiseExit(program, {
        signal: context.signal,
      });

      if (Exit.isSuccess(exit)) {
        return exit.value;
      }

      if (Chunk.isNonEmpty(Cause.defects(exit.cause))) {
        throw new EffectHandlerDefectError(metadata.operationId, exit.cause);
      }
      if (Cause.isInterrupted(exit.cause)) {
        throw new EffectHandlerInterruptedError(
          metadata.operationId,
          exit.cause
        );
      }

      const failure = Cause.failureOption(exit.cause);
      if (Option.isSome(failure)) {
        return mapError(failure.value, context);
      }

      throw new EffectHandlerDefectError(metadata.operationId, exit.cause);
    },
    dispose: () => {
      disposal ??= runtime.dispose();
      return disposal;
    },
  };
};
