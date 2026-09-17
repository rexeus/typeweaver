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

/**
 * Path parameters are guaranteed for a matched route, so the raw container is
 * required when the operation declares one and absent otherwise.
 */
type RawHttpParamProperty<T> =
  T extends Readonly<Record<string, unknown>>
    ? { readonly param: Readonly<{ [Key in keyof T]: string }> }
    : { readonly param?: undefined };

/**
 * Derives the operation-specific raw transport request by narrowing
 * `IRawHttpRequest` to the route's guaranteed path parameters.
 *
 * Raw query and header stay the open `IRawHttpQuery`/`IRawHttpHeader` records:
 * adapters emit lowercase runtime keys, undeclared keys, and repeated or
 * comma-delimited values, none of which the validated schema can promise.
 * `method` stays `HttpMethod` because a HEAD request may fall back to a GET
 * route, and the body stays optional `unknown`.
 */
export type IRawHttpRequestFor<TRequest extends IValidatedHttpRequest> = Omit<
  IRawHttpRequest,
  "param"
> &
  RawHttpParamProperty<TRequest["param"]>;
