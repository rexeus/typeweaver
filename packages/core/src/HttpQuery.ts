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

export type IHttpQuery = Record<string, string | string[]> | undefined;

type ZodStringType =
  | ZodString
  | ZodStringFormat
  | ZodLiteral<string>
  | ZodEnum<Record<string, string>>;

type HttpQueryValue =
  | ZodStringType
  | ZodOptional<ZodStringType>
  | ZodArray<ZodStringType>
  | ZodOptional<ZodArray<ZodStringType>>;

type HttpQueryObject =
  | ZodObject<Record<string, HttpQueryValue>>
  | ZodRecord<ZodStringType, HttpQueryValue>;

export type HttpQuerySchema = HttpQueryObject | ZodOptional<HttpQueryObject>;
