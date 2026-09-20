import type {
  ZodArray,
  ZodEnum,
  ZodLiteral,
  ZodObject,
  ZodOptional,
  ZodRecord,
  ZodString,
  ZodStringFormat,
} from "zod";

/**
 * Transport-safe HTTP response headers.
 *
 * A header key may be present with an explicit `undefined` value at the
 * boundary: schema-derived request and response contracts model optional
 * headers that way under `exactOptionalPropertyTypes`.
 */
export type IHttpHeader =
  | Record<string, string | string[] | undefined>
  | undefined;

export type RawHttpHeaderValue = string | readonly string[] | undefined;

export type IRawHttpHeader =
  | Readonly<Record<string, RawHttpHeaderValue>>
  | undefined;

type ZodStringType =
  | ZodString
  | ZodStringFormat
  | ZodLiteral<string>
  | ZodEnum<Record<string, string>>;

type HttpHeaderValue =
  | ZodStringType
  | ZodOptional<ZodStringType>
  | ZodArray<ZodStringType>
  | ZodOptional<ZodArray<ZodStringType>>;

type HttpHeaderObject =
  | ZodObject<Record<string, HttpHeaderValue>>
  | ZodRecord<ZodStringType, HttpHeaderValue>;

/**
 * Transport-safe response-header schema, restored exactly from the stack base.
 * Response header values must produce `string` or `string[]`.
 */
export type HttpHeaderSchema = HttpHeaderObject | ZodOptional<HttpHeaderObject>;

/**
 * Broad request-header schema. Request headers are parsed from raw strings, so
 * their inputs and outputs may be wider than the response contract: coercion,
 * domain scalars, arrays, and records are all supported.
 */
type RequestHeaderObject = ZodObject | ZodRecord;

export type HttpRequestHeaderSchema =
  | RequestHeaderObject
  | ZodOptional<RequestHeaderObject>;

/** Any header container schema accepted by the shared runtime validator. */
export type HttpHeaderSchemaLike = HttpHeaderSchema | HttpRequestHeaderSchema;
