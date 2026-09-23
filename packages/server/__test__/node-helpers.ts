import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { OutgoingHttpHeader, OutgoingHttpHeaders } from "node:http";

export type NodeRequestHeaders = Record<string, string | string[] | undefined>;

export type NodeRequestWireMetadata = {
  readonly rawHeaders?: readonly string[];
  readonly headersDistinct?: NodeRequestHeaders;
};

export type MockIncomingMessageOptions = {
  readonly body?: string | Buffer | undefined;
  readonly wireMetadata?: NodeRequestWireMetadata | undefined;
};

export type MockServerResponse = ServerResponse & {
  readonly writtenStatus: number | undefined;
  readonly writtenHeaders: Record<string, string>;
  readonly writtenRawHeaders: Record<string, string | string[]>;
  readonly writtenBody: string;
  readonly writtenBodyBuffer: Buffer;
};

export function createMockIncomingMessage(
  method: string,
  url: string | undefined,
  headers: NodeRequestHeaders = {},
  bodyOrOptions?: string | Buffer | MockIncomingMessageOptions
): IncomingMessage {
  const options =
    typeof bodyOrOptions === "string" || Buffer.isBuffer(bodyOrOptions)
      ? { body: bodyOrOptions }
      : (bodyOrOptions ?? {});
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost:3000", ...headers };
  applyNodeRequestWireMetadata(req, req.headers, options.wireMetadata);

  if (options.body !== undefined) {
    process.nextTick(() => {
      req.push(
        Buffer.isBuffer(options.body)
          ? options.body
          : Buffer.from(options.body ?? "")
      );
      req.push(null);
    });
  } else {
    process.nextTick(() => req.push(null));
  }

  return req;
}

export function createControlledIncomingMessage(
  method: string,
  url: string | undefined,
  headers: NodeRequestHeaders = {},
  wireMetadata?: NodeRequestWireMetadata
): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost:3000", ...headers };
  applyNodeRequestWireMetadata(req, req.headers, wireMetadata);
  return req;
}

export function applyNodeRequestWireMetadata(
  req: IncomingMessage,
  headers: NodeRequestHeaders,
  wireMetadata?: NodeRequestWireMetadata
): void {
  req.rawHeaders = [...(wireMetadata?.rawHeaders ?? createRawHeaders(headers))];
  Object.defineProperty(req, "headersDistinct", {
    configurable: true,
    value: createHeadersDistinct(headers, wireMetadata?.headersDistinct),
  });
}

function createRawHeaders(headers: NodeRequestHeaders): string[] {
  const rawHeaders: string[] = [];

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      rawHeaders.push(name, item);
    }
  }

  return rawHeaders;
}

function createHeadersDistinct(
  headers: NodeRequestHeaders,
  headersDistinct: NodeRequestHeaders = headers
): NodeRequestHeaders {
  const distinct: NodeRequestHeaders = {};

  for (const [name, value] of Object.entries(headersDistinct)) {
    if (value === undefined) {
      continue;
    }

    const lowerCaseName = name.toLowerCase();
    const existingValue = distinct[lowerCaseName];
    const existingValues = Array.isArray(existingValue)
      ? existingValue
      : existingValue === undefined
        ? []
        : [existingValue];
    distinct[lowerCaseName] = existingValues.concat(value);
  }

  return distinct;
}

/**
 * A socket that accepts and discards every write, so a response can finish
 * without a peer.
 */
class DiscardingSocket extends Socket {
  public override _write(
    _chunk: unknown,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    callback();
  }

  public override _writev(
    _chunks: readonly { chunk: unknown; encoding: BufferEncoding }[],
    callback: (error?: Error | null) => void
  ): void {
    callback();
  }
}

/**
 * A Node response that records the status, headers, and final body the adapter
 * writes while still running Node's own response implementation.
 */
class RecordingServerResponse
  extends ServerResponse
  implements MockServerResponse
{
  private recordedStatus: number | undefined;
  private readonly recordedHeaders: Record<string, string> = {};
  private readonly recordedRawHeaders: Record<string, string | string[]> = {};
  private recordedBody = "";
  private recordedBodyBuffer: Buffer = Buffer.alloc(0);

  public get writtenStatus(): number | undefined {
    return this.recordedStatus;
  }

  public get writtenHeaders(): Record<string, string> {
    return { ...this.recordedHeaders };
  }

  public get writtenRawHeaders(): Record<string, string | string[]> {
    return { ...this.recordedRawHeaders };
  }

  public get writtenBody(): string {
    return this.recordedBody;
  }

  public get writtenBodyBuffer(): Buffer {
    return this.recordedBodyBuffer;
  }

  public override setHeader(
    name: string,
    value: number | string | readonly string[]
  ): this {
    const isList = typeof value === "object";
    this.recordedHeaders[name] = isList ? value.join(", ") : String(value);
    this.recordedRawHeaders[name] = isList ? [...value] : String(value);
    return super.setHeader(name, value);
  }

  public override writeHead(
    statusCode: number,
    statusMessageOrHeaders?:
      | string
      | OutgoingHttpHeaders
      | OutgoingHttpHeader[],
    headers?: OutgoingHttpHeaders | OutgoingHttpHeader[]
  ): this {
    this.recordedStatus = statusCode;
    if (typeof statusMessageOrHeaders !== "object") {
      return super.writeHead(statusCode, statusMessageOrHeaders, headers);
    }

    for (const [key, value] of Object.entries(statusMessageOrHeaders)) {
      this.recordedHeaders[key] = String(value);
    }
    return super.writeHead(statusCode, statusMessageOrHeaders);
  }

  public override end(chunk?: unknown): this {
    this.recordBody(chunk);
    return super.end(chunk);
  }

  private recordBody(chunk: unknown): void {
    if (typeof chunk === "string" && chunk !== "") {
      this.recordedBody = chunk;
      this.recordedBodyBuffer = Buffer.from(chunk);
    } else if (chunk instanceof Uint8Array) {
      this.recordedBody = String(chunk);
      this.recordedBodyBuffer = Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);
    }
  }
}

export function createMockServerResponse(
  req: IncomingMessage
): MockServerResponse {
  const res = new RecordingServerResponse(req);
  res.assignSocket(new DiscardingSocket());
  return res;
}

export function awaitResponse(res: ServerResponse): Promise<void> {
  return new Promise<void>(resolve => {
    res.on("finish", resolve);
  });
}
