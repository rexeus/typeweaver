import type { IHttpRequest, IHttpResponse } from "@rexeus/typeweaver-core";
import type { FetchApiAdapter } from "../../src/lib/FetchApiAdapter.js";
import type { HttpAdapter } from "../../src/lib/HttpAdapter.js";

type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertFalse<Condition extends false> = Condition;

type AdapterResponse = Parameters<FetchApiAdapter["toResponse"]>[0];

export type DefaultHttpAdapterRequestIsNotAny = AssertFalse<
  IsAny<Parameters<HttpAdapter["toRequest"]>[0]>
>;
export type DefaultHttpAdapterResponseIsNotAny = AssertFalse<
  IsAny<ReturnType<HttpAdapter["toResponse"]>>
>;
export type DefaultHttpAdapterContextIsNotAny = AssertFalse<
  IsAny<Parameters<HttpAdapter["toRequest"]>[1]>
>;
export type FetchAdapterResponseBodyIsNotAny = AssertFalse<
  IsAny<AdapterResponse["body"]>
>;
export type CoreRequestBodyIsNotAny = AssertFalse<IsAny<IHttpRequest["body"]>>;
export type CoreResponseBodyIsNotAny = AssertFalse<
  IsAny<IHttpResponse["body"]>
>;
