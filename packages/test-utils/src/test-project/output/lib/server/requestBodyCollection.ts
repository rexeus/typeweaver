import { isBodySizeOverLimit } from "./BodyLimitPolicy.js";
import {
  RequestBodyClosedBeforeEndError,
  RequestBodyReadAbortedError,
  PayloadTooLargeError,
} from "./errors/index.js";
import type { IncomingMessage } from "node:http";

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

export function collectRequestBody(
  req: IncomingMessage,
  maxBodySize: number,
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
    const onError = (error: unknown): void => settleBodyCollection(state, { error });
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

const settleBodyCollection = (
  state: BodyCollectionState,
  outcome: { readonly body: ArrayBuffer } | { readonly error: unknown },
): void => {
  if (state.isSettled) return;
  state.isSettled = true;
  state.cleanup();
  if ("body" in outcome) state.resolve(outcome.body);
  else state.reject(outcome.error);
};

const handleCollectedData = (state: BodyCollectionState, chunk: Buffer): void => {
  if (state.isSettled) return;

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
      error: new RequestBodyClosedBeforeEndError(state.totalBytes, state.maxBodySize),
    });
  }
};

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
