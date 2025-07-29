import type {
  ZodLiteral,
  ZodObject,
  ZodString,
  ZodStringFormat,
  ZodEnum,
} from "zod/v4";

export type IHttpParam = Record<string, string> | undefined;

type HttpParamValue =
  | ZodString
  | ZodStringFormat
  | ZodLiteral<string>
  | ZodEnum<Record<string, string>>;

export type HttpParamSchema = ZodObject<Record<string, HttpParamValue>>;
