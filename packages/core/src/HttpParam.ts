import type {
  ZodEnum,
  ZodLiteral,
  ZodObject,
  ZodString,
  ZodStringFormat,
} from "zod";

export type IHttpParam = Record<string, string> | undefined;

type HttpParamValue =
  | ZodString
  | ZodStringFormat
  | ZodLiteral<string>
  | ZodEnum<Record<string, string>>;

export type HttpParamSchema = ZodObject<Record<string, HttpParamValue>>;
