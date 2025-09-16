import type {
  ZodArray,
  ZodEnum,
  ZodLiteral,
  ZodObject,
  ZodOptional,
  ZodString,
  ZodStringFormat,
} from "zod";

export type IHttpHeader = Record<string, string | string[]> | undefined;

type HttpHeaderValue =
  | ZodString
  | ZodStringFormat
  | ZodLiteral<string>
  | ZodEnum<Record<string, string>>;

type HttpHeaderObject = ZodObject<
  Record<
    string,
    | HttpHeaderValue
    | ZodOptional<HttpHeaderValue>
    | ZodArray<HttpHeaderValue>
    | ZodOptional<ZodArray<HttpHeaderValue>>
  >
>;

export type HttpHeaderSchema = HttpHeaderObject | ZodOptional<HttpHeaderObject>;
