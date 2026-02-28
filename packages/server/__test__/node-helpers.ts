import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { PassThrough } from "node:stream";

export type MockServerResponse = ServerResponse & {
  readonly writtenStatus: number | undefined;
  readonly writtenHeaders: Record<string, string>;
  readonly writtenRawHeaders: Record<string, string | string[]>;
  readonly writtenBody: string;
  readonly writtenBodyBuffer: Buffer;
};

export function createMockIncomingMessage(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body?: string | Buffer
): IncomingMessage {
  const socket = new Socket();
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost:3000", ...headers };

  if (body) {
    process.nextTick(() => {
      req.push(Buffer.isBuffer(body) ? body : Buffer.from(body));
      req.push(null);
    });
  } else {
    process.nextTick(() => req.push(null));
  }

  return req;
}

export function createMockServerResponse(
  req: IncomingMessage
): MockServerResponse {
  const res = new ServerResponse(req);
  res.assignSocket(new PassThrough() as any);

  let writtenStatus: number | undefined;
  const writtenHeaders: Record<string, string> = {};
  const writtenRawHeaders: Record<string, string | string[]> = {};
  let writtenBody = "";
  let writtenBodyBuffer = Buffer.alloc(0);

  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = ((name: string, value: string | string[]) => {
    writtenHeaders[name] = Array.isArray(value) ? value.join(", ") : value;
    writtenRawHeaders[name] = value;
    return originalSetHeader(name, value);
  }) as any;

  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = ((statusCode: number, ...args: any[]) => {
    writtenStatus = statusCode;
    const headers =
      typeof args[0] === "object" && args[0] !== null ? args[0] : undefined;
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        writtenHeaders[key] = String(value);
      }
    }
    return originalWriteHead(statusCode, ...args);
  }) as any;

  const originalEnd = res.end.bind(res);
  res.end = ((chunk?: any) => {
    if (chunk) {
      writtenBody = String(chunk);
      writtenBodyBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    }
    return originalEnd(chunk);
  }) as any;

  return Object.defineProperties(res, {
    writtenStatus: { get: () => writtenStatus },
    writtenHeaders: { get: () => ({ ...writtenHeaders }) },
    writtenRawHeaders: { get: () => ({ ...writtenRawHeaders }) },
    writtenBody: { get: () => writtenBody },
    writtenBodyBuffer: { get: () => writtenBodyBuffer },
  }) as any;
}

export function awaitResponse(res: ServerResponse): Promise<void> {
  return new Promise<void>(resolve => {
    res.on("finish", resolve);
  });
}
