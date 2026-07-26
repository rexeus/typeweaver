import type {
  IHttpBody,
  IHttpRequest,
  IHttpResponse,
  ITypedHttpResponse,
} from "../../src/index.js";

type IsAny<T> = 0 extends 1 & T ? true : false;
type AssertFalse<Condition extends false> = Condition;

export type HttpBodyIsNotAny = AssertFalse<IsAny<IHttpBody>>;
export type DefaultRequestBodyIsNotAny = AssertFalse<
  IsAny<IHttpRequest["body"]>
>;
export type DefaultResponseBodyIsNotAny = AssertFalse<
  IsAny<IHttpResponse["body"]>
>;
export type DefaultTypedResponseBodyIsNotAny = AssertFalse<
  IsAny<ITypedHttpResponse["body"]>
>;
