import { HttpStatusCode } from "./HttpStatusCode.js";
import type { IHttpHeader } from "./HttpHeader.js";
import type { IHttpResponse } from "./HttpResponse.js";

export type DefaultErrorDescriptor<
  StatusCode extends HttpStatusCode = HttpStatusCode,
  Code extends string = string,
  Message extends string = string,
> = {
  readonly statusCode: StatusCode;
  readonly code: Code;
  readonly message: Message;
};

export type DefaultErrorBody<
  Descriptor extends DefaultErrorDescriptor,
  AdditionalBody extends Record<string, unknown> = {},
> = Readonly<
  Omit<AdditionalBody, "code" | "message"> & {
    code: Descriptor["code"];
    message: Descriptor["message"];
  }
>;

export type DefaultErrorResponse<
  Descriptor extends DefaultErrorDescriptor,
  Header extends IHttpHeader | undefined = undefined,
  AdditionalBody extends Record<string, unknown> = {},
> = Omit<
  IHttpResponse<Header, DefaultErrorBody<Descriptor, AdditionalBody>>,
  "statusCode"
> & {
  readonly statusCode: Descriptor["statusCode"];
};

export const badRequestDefaultError = {
  statusCode: HttpStatusCode.BAD_REQUEST,
  code: "BAD_REQUEST",
  message: "Malformed request body",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.BAD_REQUEST,
  "BAD_REQUEST",
  "Malformed request body"
>;

export const validationDefaultError = {
  statusCode: HttpStatusCode.BAD_REQUEST,
  code: "VALIDATION_ERROR",
  message: "Invalid request",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.BAD_REQUEST,
  "VALIDATION_ERROR",
  "Invalid request"
>;

export const unauthorizedDefaultError = {
  statusCode: HttpStatusCode.UNAUTHORIZED,
  code: "UNAUTHORIZED_ERROR",
  message: "Unauthorized request",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.UNAUTHORIZED,
  "UNAUTHORIZED_ERROR",
  "Unauthorized request"
>;

export const forbiddenDefaultError = {
  statusCode: HttpStatusCode.FORBIDDEN,
  code: "FORBIDDEN_ERROR",
  message: "Forbidden request",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.FORBIDDEN,
  "FORBIDDEN_ERROR",
  "Forbidden request"
>;

export const notFoundDefaultError = {
  statusCode: HttpStatusCode.NOT_FOUND,
  code: "NOT_FOUND",
  message: "No matching resource found",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.NOT_FOUND,
  "NOT_FOUND",
  "No matching resource found"
>;

export const methodNotAllowedDefaultError = {
  statusCode: HttpStatusCode.METHOD_NOT_ALLOWED,
  code: "METHOD_NOT_ALLOWED",
  message: "Method not allowed for this resource",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.METHOD_NOT_ALLOWED,
  "METHOD_NOT_ALLOWED",
  "Method not allowed for this resource"
>;

export const payloadTooLargeDefaultError = {
  statusCode: HttpStatusCode.PAYLOAD_TOO_LARGE,
  code: "PAYLOAD_TOO_LARGE",
  message: "Request body exceeds size limit",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.PAYLOAD_TOO_LARGE,
  "PAYLOAD_TOO_LARGE",
  "Request body exceeds size limit"
>;

export const internalServerErrorDefaultError = {
  statusCode: HttpStatusCode.INTERNAL_SERVER_ERROR,
  code: "INTERNAL_SERVER_ERROR",
  message: "Internal server error occurred",
} as const satisfies DefaultErrorDescriptor<
  HttpStatusCode.INTERNAL_SERVER_ERROR,
  "INTERNAL_SERVER_ERROR",
  "Internal server error occurred"
>;

export const defaultErrorDescriptors = {
  badRequest: badRequestDefaultError,
  validation: validationDefaultError,
  unauthorized: unauthorizedDefaultError,
  forbidden: forbiddenDefaultError,
  notFound: notFoundDefaultError,
  methodNotAllowed: methodNotAllowedDefaultError,
  payloadTooLarge: payloadTooLargeDefaultError,
  internalServerError: internalServerErrorDefaultError,
} as const;

// The public signatures let callers pin `AdditionalBody` and `Header` independently
// of the optional arguments, so the generic result is declared by an overload whose
// implementation is checked against the widest descriptor and body types.
function buildDefaultErrorBody<
  Descriptor extends DefaultErrorDescriptor,
  AdditionalBody extends Record<string, unknown>,
>(
  descriptor: Descriptor,
  additionalBody: AdditionalBody | undefined
): DefaultErrorBody<Descriptor, AdditionalBody>;
function buildDefaultErrorBody(
  descriptor: DefaultErrorDescriptor,
  additionalBody: Record<string, unknown> | undefined
): DefaultErrorBody<DefaultErrorDescriptor, Record<string, unknown>> {
  return {
    ...additionalBody,
    code: descriptor.code,
    message: descriptor.message,
  };
}

function buildDefaultErrorResponse<
  Descriptor extends DefaultErrorDescriptor,
  Header extends IHttpHeader | undefined,
  AdditionalBody extends Record<string, unknown>,
>(
  descriptor: Descriptor,
  header: Header | undefined,
  body: DefaultErrorBody<Descriptor, AdditionalBody>
): DefaultErrorResponse<Descriptor, Header, AdditionalBody>;
function buildDefaultErrorResponse(
  descriptor: DefaultErrorDescriptor,
  header: IHttpHeader | undefined,
  body: DefaultErrorBody<DefaultErrorDescriptor, Record<string, unknown>>
): DefaultErrorResponse<
  DefaultErrorDescriptor,
  IHttpHeader | undefined,
  Record<string, unknown>
> {
  return { statusCode: descriptor.statusCode, header, body };
}

export const createDefaultErrorBody = <
  Descriptor extends DefaultErrorDescriptor,
  AdditionalBody extends Record<string, unknown> = {},
>(
  descriptor: Descriptor,
  additionalBody?: AdditionalBody
): DefaultErrorBody<Descriptor, AdditionalBody> =>
  buildDefaultErrorBody(descriptor, additionalBody);

export const createDefaultErrorResponse = <
  Descriptor extends DefaultErrorDescriptor,
  Header extends IHttpHeader | undefined = undefined,
  AdditionalBody extends Record<string, unknown> = {},
>(
  descriptor: Descriptor,
  input?: {
    readonly header?: Header;
    readonly body?: AdditionalBody;
  }
): DefaultErrorResponse<Descriptor, Header, AdditionalBody> =>
  buildDefaultErrorResponse(
    descriptor,
    input?.header,
    createDefaultErrorBody(descriptor, input?.body)
  );
