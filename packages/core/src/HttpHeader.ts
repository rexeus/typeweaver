import type { ZodObject, ZodOptional, ZodRecord } from "zod";

/** Transport-safe HTTP response headers. */
export type IHttpHeader = Record<string, string | string[]> | undefined;

export type RawHttpHeaderValue = string | readonly string[];

export type IRawHttpHeader =
  | Readonly<Record<string, RawHttpHeaderValue>>
  | undefined;

type HttpHeaderObject = ZodObject | ZodRecord;

export type HttpHeaderSchema = HttpHeaderObject | ZodOptional<HttpHeaderObject>;
