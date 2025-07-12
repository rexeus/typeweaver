import type {
  ZodArray,
  ZodLiteral,
  ZodObject,
  ZodString,
  ZodStringFormat,
  ZodEnum,
  ZodOptional,
} from "zod/v4";

export type IHttpHeader = Record<string, string | string[]> | undefined;

type HttpHeaderValue =
  | ZodString
  | ZodStringFormat
  | ZodLiteral<string>
  | ZodEnum<Record<string, string>>;

export type HttpHeaderSchema = ZodObject<
  Record<
    string,
    | HttpHeaderValue
    | ZodOptional<HttpHeaderValue>
    | ZodArray<HttpHeaderValue>
    | ZodOptional<ZodArray<HttpHeaderValue>>
  >
>;
