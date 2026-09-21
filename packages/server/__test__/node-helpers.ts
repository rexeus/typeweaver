import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { PassThrough } from "node:stream";

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

export function createMockServerResponse(
  req: IncomingMessage
): MockServerResponse {
  const res = new ServerResponse(req);
  res.assignSocket(new PassThrough() as unknown as Socket);

  let writtenStatus: number | undefined;
  const writtenHeaders: Record<string, string> = {};
  const writtenRawHeaders: Record<string, string | string[]> = {};
  let writtenBody = "";
  let writtenBodyBuffer: Buffer = Buffer.alloc(0);

  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = ((
    name: string,
    value: number | string | readonly string[]
  ) => {
    writtenHeaders[name] = Array.isArray(value)
      ? value.join(", ")
      : String(value);
    writtenRawHeaders[name] = Array.isArray(value)
      ? [...(value as readonly string[])]
      : String(value);
    return originalSetHeader(name, value);
  }) as unknown as typeof res.setHeader;

  const originalWriteHead = res.writeHead.bind(res);
  const writeHead = originalWriteHead as (
    statusCode: number,
    ...args: unknown[]
  ) => ServerResponse;
  res.writeHead = ((statusCode: number, ...args: unknown[]) => {
    writtenStatus = statusCode;
    const headers =
      typeof args[0] === "object" && args[0] !== null ? args[0] : undefined;
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        writtenHeaders[key] = String(value);
      }
    }
    return writeHead(statusCode, ...args);
  }) as unknown as typeof res.writeHead;

  const originalEnd = res.end.bind(res);
  const end = originalEnd as (chunk?: unknown) => ServerResponse;
  res.end = ((chunk?: string | Buffer | Uint8Array) => {
    if (chunk) {
      writtenBody = String(chunk);
      writtenBodyBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
    return end(chunk);
  }) as unknown as typeof res.end;

  return Object.defineProperties(res, {
    writtenStatus: { get: () => writtenStatus },
    writtenHeaders: { get: () => ({ ...writtenHeaders }) },
    writtenRawHeaders: { get: () => ({ ...writtenRawHeaders }) },
    writtenBody: { get: () => writtenBody },
    writtenBodyBuffer: { get: () => writtenBodyBuffer },
  }) as unknown as MockServerResponse;
}

export function awaitResponse(res: ServerResponse): Promise<void> {
  return new Promise<void>(resolve => {
    res.on("finish", resolve);
  });
}
