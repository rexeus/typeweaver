import type { IncomingMessage } from "node:http";

const ORIGIN_FORM_BASE_URL_PROTOCOL = "http:";
const AUTHORITY_LIKE_REQUEST_TARGET_PREFIX = /^[\\/]{2}/;
const ASTERISK_FORM_REQUEST_TARGET = "*";

type ParsedAuthority = {
  readonly host: string;
  readonly hostname: string;
  readonly port: string;
};

export function createRequestUrl(req: IncomingMessage): URL | undefined {
  const rawUrl = req.url ?? "/";

  if (rawUrl === ASTERISK_FORM_REQUEST_TARGET) {
    return createAsteriskFormRequestUrl(req);
  }

  if (hasAuthorityLikeRequestTargetPrefix(rawUrl)) {
    return undefined;
  }

  try {
    const url = new URL(rawUrl);
    return isAbsoluteRequestHostAllowed(url, req) ? url : undefined;
  } catch (error) {
    if (!(error instanceof TypeError) || !rawUrl.startsWith("/")) {
      throw error;
    }
  }

  const host = parseRequestHostHeader(req, ORIGIN_FORM_BASE_URL_PROTOCOL);
  if (host === undefined) {
    return undefined;
  }

  return new URL(rawUrl, `${ORIGIN_FORM_BASE_URL_PROTOCOL}//${host.host}`);
}

function createAsteriskFormRequestUrl(req: IncomingMessage): URL | undefined {
  if (req.method !== "OPTIONS") {
    return undefined;
  }

  const host = parseRequestHostHeader(req, ORIGIN_FORM_BASE_URL_PROTOCOL);
  if (host === undefined) {
    return undefined;
  }

  return new URL(ASTERISK_FORM_REQUEST_TARGET, `${ORIGIN_FORM_BASE_URL_PROTOCOL}//${host.host}/`);
}

function hasAuthorityLikeRequestTargetPrefix(rawUrl: string): boolean {
  return AUTHORITY_LIKE_REQUEST_TARGET_PREFIX.test(rawUrl);
}

function isAbsoluteRequestHostAllowed(url: URL, req: IncomingMessage): boolean {
  const host = parseRequestHostHeader(req, url.protocol);
  if (host === undefined) {
    return false;
  }

  const urlAuthority = getUrlAuthority(url);
  return (
    host.hostname.toLowerCase() === urlAuthority.hostname.toLowerCase() &&
    host.port === urlAuthority.port
  );
}

function parseRequestHostHeader(
  req: IncomingMessage,
  protocol: string,
): ParsedAuthority | undefined {
  if (!hasExactlyOneHostHeaderLine(req)) {
    return undefined;
  }

  return parseHostHeader(req.headers.host, protocol);
}

function hasExactlyOneHostHeaderLine(req: IncomingMessage): boolean {
  const headersDistinctHostCount = getHeadersDistinctHostCount(req);
  if (headersDistinctHostCount !== undefined && headersDistinctHostCount !== 1) {
    return false;
  }

  const rawHostHeaderCount = countRawHostHeaderLines(req.rawHeaders);
  if (rawHostHeaderCount > 0) {
    return rawHostHeaderCount === 1;
  }

  return headersDistinctHostCount === 1;
}

function getHeadersDistinctHostCount(req: IncomingMessage): number | undefined {
  const hostHeader = req.headersDistinct?.["host"];
  if (hostHeader === undefined) {
    return undefined;
  }

  return Array.isArray(hostHeader) ? hostHeader.length : 1;
}

function countRawHostHeaderLines(rawHeaders: readonly string[]): number {
  let count = 0;

  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === "host") {
      count += 1;
    }
  }

  return count;
}

function parseHostHeader(
  hostHeader: IncomingMessage["headers"]["host"],
  protocol: string,
): ParsedAuthority | undefined {
  if (hostHeader === undefined || Array.isArray(hostHeader)) {
    return undefined;
  }

  const host = hostHeader.trim();
  if (host === "" || host !== hostHeader) {
    return undefined;
  }

  try {
    const parsed = new URL(`${protocol}//${host}`);
    if (!isPlainAuthorityUrl(parsed)) {
      return undefined;
    }

    return getUrlAuthority(parsed);
  } catch {
    return undefined;
  }
}

function isPlainAuthorityUrl(url: URL): boolean {
  return (
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === ""
  );
}

function getUrlAuthority(url: URL): ParsedAuthority {
  return {
    host: url.host,
    hostname: url.hostname,
    port: getEffectivePort(url),
  };
}

function getEffectivePort(url: URL): string {
  return url.port === "" ? getDefaultPort(url.protocol) : url.port;
}

function getDefaultPort(protocol: string): string {
  switch (protocol) {
    case "http:":
    case "ws:":
      return "80";
    case "https:":
    case "wss:":
      return "443";
    case "ftp:":
      return "21";
    default:
      return "";
  }
}
