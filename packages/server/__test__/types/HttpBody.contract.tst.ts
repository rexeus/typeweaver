import type { FetchApiAdapter } from "../../src/lib/FetchApiAdapter.js";
import type { RequestHandler } from "../../src/lib/RequestHandler.js";

type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertFalse<Condition extends false> = Condition;

type HandlerRequest = Parameters<RequestHandler>[0];
type HandlerResponse = Awaited<ReturnType<RequestHandler>>;
type AdapterResponse = Parameters<FetchApiAdapter["toResponse"]>[0];

export type DefaultHandlerRequestBodyIsNotAny = AssertFalse<
  IsAny<HandlerRequest["body"]>
>;
export type DefaultHandlerResponseBodyIsNotAny = AssertFalse<
  IsAny<HandlerResponse["body"]>
>;
export type AdapterResponseBodyIsNotAny = AssertFalse<
  IsAny<AdapterResponse["body"]>
>;
