import { HttpStatusCode } from "./HttpStatusCode.js";
import type { IHttpHeader } from "./HttpHeader.js";
import type {
  IHttpResponse,
  ITypedHttpResponse,
  ITypedHttpResponseHeader,
} from "./HttpResponse.js";

const allowedHttpStatusCodes = new Set(
  Object.values(HttpStatusCode).filter(
    (value): value is HttpStatusCode => typeof value === "number"
  )
);

const hasOwnProperty = (value: object, property: PropertyKey): boolean => {
  return Object.prototype.hasOwnProperty.call(value, property);
};

const isRegisteredHttpStatusCode = (
  value: unknown
): value is HttpStatusCode => {
  return typeof value === "number" && allowedHttpStatusCodes.has(value);
};

const isHttpHeaderValue = (
  value: unknown
): value is string | string[] | undefined => {
  return (
    value === undefined ||
    typeof value === "string" ||
    (Array.isArray(value) && value.every(item => typeof item === "string"))
  );
};

const isRecordObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
};

const isTypedHttpResponseHeader = (
  value: unknown
): value is ITypedHttpResponseHeader => {
  return (
    value === undefined ||
    (isRecordObject(value) && Object.values(value).every(isHttpHeaderValue))
  );
};

export const isTypedHttpResponse = (
  value: unknown
): value is ITypedHttpResponse => {
  if (!isRecordObject(value)) {
    return false;
  }

  const candidate = value as Record<PropertyKey, unknown>;

  return (
    hasOwnProperty(candidate, "type") &&
    typeof candidate.type === "string" &&
    hasOwnProperty(candidate, "statusCode") &&
    isRegisteredHttpStatusCode(candidate.statusCode) &&
    (!hasOwnProperty(candidate, "header") ||
      isTypedHttpResponseHeader(candidate.header))
  );
};

export const toHttpHeader = (
  header: ITypedHttpResponse["header"]
): IHttpHeader => {
  if (!header) return undefined;

  const normalizedHeader: NonNullable<IHttpHeader> = {};
  for (const [key, value] of Object.entries(header)) {
    if (value !== undefined) normalizedHeader[key] = value;
  }

  return Object.keys(normalizedHeader).length > 0
    ? normalizedHeader
    : undefined;
};

export const toHttpResponse = (
  response: ITypedHttpResponse
): IHttpResponse => ({
  statusCode: response.statusCode,
  header: toHttpHeader(response.header),
  body: response.body,
});

export const normalizeHttpResponse = (
  response: IHttpResponse | ITypedHttpResponse
): IHttpResponse =>
  isTypedHttpResponse(response) ? toHttpResponse(response) : response;
