import { HttpStatusCode } from "./HttpStatusCode.js";
import type { IHttpBody } from "./HttpBody.js";
import type { IHttpHeader } from "./HttpHeader.js";

export type IHttpResponse<
  Header extends IHttpHeader = IHttpHeader,
  Body extends IHttpBody = IHttpBody,
> = {
  readonly statusCode: HttpStatusCode;
  readonly header?: Header;
  readonly body?: Body;
};

export type ITypedHttpResponseHeader =
  | Record<string, string | string[] | undefined>
  | undefined;

export type ITypedHttpResponse<
  TypeName extends string = string,
  StatusCode extends HttpStatusCode = HttpStatusCode,
  Header extends ITypedHttpResponseHeader = ITypedHttpResponseHeader,
  Body extends IHttpBody | undefined = IHttpBody | undefined,
> = {
  readonly type: TypeName;
  readonly statusCode: StatusCode;
  readonly header: Header;
  readonly body: Body;
};

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
