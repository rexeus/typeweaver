import type { ZodObject, ZodOptional, ZodRecord } from "zod";

/**
 * Transport-safe HTTP query values.
 *
 * A query key may be present with an explicit `undefined` value at the
 * boundary: schema-derived request contracts model optional query parameters
 * that way under `exactOptionalPropertyTypes`.
 */
export type IHttpQuery =
  | Record<string, string | string[] | undefined>
  | undefined;

export type RawHttpQueryValue = string | readonly string[] | undefined;

export type IRawHttpQuery =
  | Readonly<Record<string, RawHttpQueryValue>>
  | undefined;

type HttpQueryObject = ZodObject | ZodRecord;

export type HttpQuerySchema = HttpQueryObject | ZodOptional<HttpQueryObject>;
