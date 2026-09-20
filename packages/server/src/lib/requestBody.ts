import { isBodySizeOverLimit, parseContentLength } from "./BodyLimitPolicy.js";
import {
  PayloadTooLargeError,
  RequestBodyClosedBeforeEndError,
  RequestBodyDrainTimeoutError,
  RequestBodyReadAbortedError,
} from "./errors/index.js";
import type { IncomingMessage } from "node:http";

type DrainRequestResult = {
  readonly exceededLimit: boolean;
  readonly timedOut: boolean;
  readonly totalBytes: number;
};

type DrainRequestOptions = {
  readonly destroyOnLimitExceeded?: boolean;
  readonly timeoutMs?: number;
};

export const REQUEST_DRAIN_TIMEOUT_MS = 5_000;

export function shouldValidateRequestBody(method?: string): boolean {
  return method !== "GET" && method !== "HEAD";
}

export function hasReadableRequestBody(req: IncomingMessage): boolean {
  return (
    req.headers["content-length"] !== undefined ||
    req.headers["transfer-encoding"] !== undefined
  );
}

export function isRequestBodyLimitError(
  error: unknown
): error is PayloadTooLargeError | RequestBodyDrainTimeoutError {
  return (
    error instanceof PayloadTooLargeError ||
    error instanceof RequestBodyDrainTimeoutError
  );
}

export function enforceContentLengthLimit(
  req: IncomingMessage,
  maxBodySize: number
): void {
  const contentLength = parseContentLength(req.headers["content-length"]);
  if (contentLength === undefined) {
    return;
  }

  if (isBodySizeOverLimit(contentLength, maxBodySize)) {
    throw new PayloadTooLargeError(contentLength, maxBodySize);
  }
}

export async function readRequestBody(
  req: IncomingMessage,
  shouldValidateBody: boolean,
  maxBodySize: number
): Promise<ArrayBuffer | undefined> {
  if (!shouldValidateBody) {
    return undefined;
  }
  return collectBody(req, maxBodySize);
}

export async function drainUnvalidatedRequestBody(
  req: IncomingMessage,
  bodyLimitPolicy: { readonly maxBodySize: number }
): Promise<void> {
  if (shouldValidateRequestBody(req.method) || !hasReadableRequestBody(req)) {
    return;
  }
  const drainResult = await drainRequest(req, bodyLimitPolicy.maxBodySize, {
    destroyOnLimitExceeded: false,
  });
  if (drainResult.exceededLimit) {
    throw new PayloadTooLargeError(
      drainResult.totalBytes,
      bodyLimitPolicy.maxBodySize
    );
  }
  if (drainResult.timedOut) {
    throw new RequestBodyDrainTimeoutError(
      bodyLimitPolicy.maxBodySize,
      REQUEST_DRAIN_TIMEOUT_MS
    );
  }
}

export function createRejectedRequestBodyCleanup(
  req: IncomingMessage,
  maxBodySize: number
): (() => void) | undefined {
  if (!hasReadableRequestBody(req)) {
    return undefined;
  }

  return () => {
    const contentLength = parseContentLength(req.headers["content-length"]);
    if (
      contentLength !== undefined &&
      isBodySizeOverLimit(contentLength, maxBodySize)
    ) {
      req.destroy();
      return;
    }

    void drainRequest(req, maxBodySize, { destroyOnLimitExceeded: true });
  };
}

export async function drainRequest(
  req: IncomingMessage,
  maxBodySize: number,
  options: DrainRequestOptions = {}
): Promise<DrainRequestResult> {
  if (req.readableEnded || req.destroyed) {
    return { exceededLimit: false, timedOut: false, totalBytes: 0 };
  }
  return await drainRequestBody(req, maxBodySize, options);
}

const drainRequestBody = (
  req: IncomingMessage,
  maxBodySize: number,
  options: DrainRequestOptions
): Promise<DrainRequestResult> =>
  new Promise<DrainRequestResult>(resolve => {
    const destroyOnLimitExceeded = options.destroyOnLimitExceeded ?? true;
    const timeoutMs = options.timeoutMs ?? REQUEST_DRAIN_TIMEOUT_MS;
    let drainedBytes = 0;
    let isSettled = false;
    let drainTimeout: NodeJS.Timeout | undefined;

    const cleanup = (): void => {
      if (drainTimeout !== undefined) {
        clearTimeout(drainTimeout);
      }
      req.off("data", handleData);
      req.off("end", handleSettled);
      req.off("error", handleSettled);
      req.off("aborted", handleSettled);
      req.off("close", handleSettled);
    };

    const finish = (
      result: Omit<DrainRequestResult, "totalBytes">,
      destroy: boolean
    ): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      cleanup();
      if (destroy) {
        req.destroy();
      }
      resolve({ ...result, totalBytes: drainedBytes });
    };

    const handleData = (chunk: Buffer | string): void => {
      drainedBytes +=
        typeof chunk === "string" ? Buffer.byteLength(chunk) : chunk.byteLength;
      if (isBodySizeOverLimit(drainedBytes, maxBodySize)) {
        finish(
          { exceededLimit: true, timedOut: false },
          destroyOnLimitExceeded
        );
      }
    };

    const handleSettled = (): void => {
      finish({ exceededLimit: false, timedOut: false }, false);
    };

    drainTimeout = setTimeout(() => {
      finish({ exceededLimit: false, timedOut: true }, destroyOnLimitExceeded);
    }, timeoutMs);
    drainTimeout.unref();

    req.on("data", handleData);
    req.on("end", handleSettled);
    req.on("error", handleSettled);
    req.on("aborted", handleSettled);
    req.on("close", handleSettled);
    req.resume();
  });

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;

type BodyCollectionState = {
  readonly req: IncomingMessage;
  readonly maxBodySize: number;
  readonly chunks: Buffer[];
  totalBytes: number;
  isSettled: boolean;
  cleanup: () => void;
  readonly resolve: (body: ArrayBuffer) => void;
  readonly reject: (error: unknown) => void;
};

const settleBodyCollection = (
  state: BodyCollectionState,
  outcome: { readonly body: ArrayBuffer } | { readonly error: unknown }
): void => {
  if (state.isSettled) {
    return;
  }
  state.isSettled = true;
  state.cleanup();
  if ("body" in outcome) {
    state.resolve(outcome.body);
  } else {
    state.reject(outcome.error);
  }
};

const handleCollectedData = (
  state: BodyCollectionState,
  chunk: Buffer
): void => {
  if (state.isSettled) {
    return;
  }

  state.totalBytes += chunk.byteLength;
  if (isBodySizeOverLimit(state.totalBytes, state.maxBodySize)) {
    state.req.pause();
    settleBodyCollection(state, {
      error: new PayloadTooLargeError(state.totalBytes, state.maxBodySize),
    });
    state.req.resume();
    return;
  }
  state.chunks.push(chunk);
};

const handleCollectedEnd = (state: BodyCollectionState): void => {
  settleBodyCollection(state, {
    body: toArrayBuffer(Buffer.concat(state.chunks, state.totalBytes)),
  });
};

const handleCollectedAborted = (state: BodyCollectionState): void => {
  settleBodyCollection(state, {
    error: new RequestBodyReadAbortedError(state.totalBytes, state.maxBodySize),
  });
};

const handleCollectedClose = (state: BodyCollectionState): void => {
  if (!state.req.readableEnded) {
    settleBodyCollection(state, {
      error: new RequestBodyClosedBeforeEndError(
        state.totalBytes,
        state.maxBodySize
      ),
    });
  }
};

function collectBody(
  req: IncomingMessage,
  maxBodySize: number
): Promise<ArrayBuffer> {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const state: BodyCollectionState = {
      req,
      maxBodySize,
      chunks: [],
      totalBytes: 0,
      isSettled: false,
      cleanup: () => undefined,
      resolve,
      reject,
    };
    const onData = (chunk: Buffer): void => handleCollectedData(state, chunk);
    const onEnd = (): void => handleCollectedEnd(state);
    const onError = (error: unknown): void =>
      settleBodyCollection(state, { error });
    const onAborted = (): void => handleCollectedAborted(state);
    const onClose = (): void => handleCollectedClose(state);

    state.cleanup = (): void => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      req.off("close", onClose);
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
    req.on("close", onClose);
  });
}
