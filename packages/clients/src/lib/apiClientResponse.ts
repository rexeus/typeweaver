import type { IHttpHeader, IHttpResponse } from "@rexeus/typeweaver-core";
import { NetworkError } from "./NetworkError.js";
import { ResponseParseError } from "./ResponseParseError.js";
import type { NetworkErrorCode } from "./NetworkError.js";

const NETWORK_ERROR_MESSAGES = {
  ECONNREFUSED: "Connection refused",
  ECONNRESET: "Connection reset by peer",
  ENOTFOUND: "DNS lookup failed",
  ETIMEDOUT: "Connection timed out",
} as const satisfies Partial<Record<NetworkErrorCode, string>>;

type NetworkFailure = {
  readonly code: NetworkErrorCode;
  readonly description: string;
};

export async function createResponse(
  response: Response,
  method: string,
  url: string
): Promise<IHttpResponse> {
  const header: IHttpHeader = {};
  response.headers.forEach((value, key) => {
    header[key] = value;
  });

  if (typeof response.headers.getSetCookie === "function") {
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) {
      header["set-cookie"] = cookies;
    }
  }

  const body = await parseResponseBody(response, method, url);

  return {
    body,
    header,
    statusCode: response.status,
  };
}

export function createNetworkError(
  error: unknown,
  method: string,
  url: string
): NetworkError {
  const failure = classifyNetworkFailure(error);
  const context = `(${method} ${url})`;

  return new NetworkError(`Network error: ${failure.description} ${context}`, {
    cause: error,
    code: failure.code,
    method,
    url,
  });
}

async function readBody<T>(
  read: () => Promise<T>,
  response: Response,
  method: string,
  url: string
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    throw new ResponseParseError(
      `Failed to read response body (${method} ${url})`,
      response.status,
      "",
      { cause: error instanceof Error ? error : undefined }
    );
  }
}

async function parseResponseBody(
  response: Response,
  method: string,
  url: string
): Promise<unknown> {
  if (response.status === 204 || response.status === 304) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");

  if (isJsonContentType(contentType)) {
    const text = await readBody(() => response.text(), response, method, url);
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch (parseError) {
      throw new ResponseParseError(
        "Failed to parse JSON response",
        response.status,
        text.slice(0, 200),
        {
          cause: parseError instanceof Error ? parseError : undefined,
        }
      );
    }
  }

  if (isTextContentType(contentType) || !contentType) {
    const text = await readBody(() => response.text(), response, method, url);
    if (!text) return undefined;
    return text;
  }

  return await readBody(() => response.arrayBuffer(), response, method, url);
}

function isTextContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.toLowerCase().includes("text/");
}

function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const normalizedContentType = contentType.toLowerCase();
  return (
    normalizedContentType.includes("application/json") ||
    normalizedContentType.includes("+json")
  );
}

function hasErrorName(error: unknown, name: string): boolean {
  return (
    (error instanceof DOMException || error instanceof Error) &&
    error.name === name
  );
}

function isKnownNetworkErrorCode(
  code: string
): code is keyof typeof NETWORK_ERROR_MESSAGES {
  return Object.hasOwn(NETWORK_ERROR_MESSAGES, code);
}

function getNodeNetworkErrorCode(
  error: unknown
): keyof typeof NETWORK_ERROR_MESSAGES | undefined {
  if (!(error instanceof TypeError)) {
    return undefined;
  }

  const cause = error.cause;
  if (
    typeof cause !== "object" ||
    cause === null ||
    !("code" in cause) ||
    typeof cause.code !== "string"
  ) {
    return undefined;
  }

  return isKnownNetworkErrorCode(cause.code) ? cause.code : undefined;
}

function classifyNetworkFailure(error: unknown): NetworkFailure {
  if (hasErrorName(error, "TimeoutError")) {
    return { code: "TIMEOUT", description: "Request timed out" };
  }

  if (hasErrorName(error, "AbortError")) {
    return { code: "ABORT", description: "Request aborted" };
  }

  const nodeErrorCode = getNodeNetworkErrorCode(error);
  if (nodeErrorCode !== undefined) {
    return {
      code: nodeErrorCode,
      description: NETWORK_ERROR_MESSAGES[nodeErrorCode],
    };
  }

  return {
    code: "UNKNOWN",
    description: error instanceof Error ? error.message : String(error),
  };
}
