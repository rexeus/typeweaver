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

export type IHttpHeader = Record<string, string | string[]> | undefined;

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

export type HttpHeaderSchema = HttpHeaderObject | ZodOptional<HttpHeaderObject>;
