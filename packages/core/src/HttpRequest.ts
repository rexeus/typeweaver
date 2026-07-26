import type { IRawHttpHeader } from "./HttpHeader.js";
import type { HttpMethod } from "./HttpMethod.js";
import type { IRawHttpParam } from "./HttpParam.js";
import type { IRawHttpQuery } from "./HttpQuery.js";

export type IHttpRequest<
  Header extends Readonly<Record<string, unknown>> | undefined = undefined,
  Param extends Readonly<Record<string, unknown>> | undefined = undefined,
  Query extends Readonly<Record<string, unknown>> | undefined = undefined,
  Body = undefined,
> = {
  readonly body?: Body;
  readonly query?: Query;
  readonly param?: Param;
  readonly header?: Header;
  readonly path: string;
  readonly method: HttpMethod;
};

/**
 * Explicit upper bound for code that accepts any already validated request.
 *
 * Prefer an operation-specific `IHttpRequest` instantiation at public
 * boundaries. This alias exists for generic infrastructure and deliberately
 * does not change the strict `IHttpRequest` defaults.
 */
export type IValidatedHttpRequest = IHttpRequest<
  Readonly<Record<string, unknown>> | undefined,
  Readonly<Record<string, unknown>> | undefined,
  Readonly<Record<string, unknown>> | undefined,
  unknown
>;

export type IRawHttpRequest = {
  readonly body?: unknown;
  readonly query?: IRawHttpQuery;
  readonly param?: IRawHttpParam;
  readonly header?: IRawHttpHeader;
  readonly path: string;
  readonly method: HttpMethod;
};

type RawHttpPartValue<T> =
  Exclude<T, undefined> extends readonly unknown[] ? readonly string[] : string;

type RawHttpPart<T> =
  T extends Readonly<Record<string, unknown>>
    ? { readonly [Key in keyof T]: RawHttpPartValue<T[Key]> }
    : undefined;

/**
 * Derives the operation-specific raw transport request from a validated
 * generated request while preserving required and optional properties.
 */
export type IRawHttpRequestFor<TRequest extends IValidatedHttpRequest> = {
  readonly [Key in keyof TRequest]: Key extends "body"
    ? unknown
    : Key extends "header" | "param" | "query"
      ? RawHttpPart<TRequest[Key]>
      : TRequest[Key];
};
