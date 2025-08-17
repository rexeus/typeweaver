import type {
  ZodArray,
  ZodEnum,
  ZodLiteral,
  ZodObject,
  ZodOptional,
  ZodString,
  ZodStringFormat,
} from "zod/v4";

export type IHttpQuery = Record<string, string | string[]> | undefined;

type HttpQueryValue =
  | ZodString
  | ZodStringFormat
  | ZodLiteral<string>
  | ZodEnum<Record<string, string>>;

export type HttpQuerySchema = ZodObject<
  Record<
    string,
    | HttpQueryValue
    | ZodOptional<HttpQueryValue>
    | ZodArray<HttpQueryValue>
    | ZodOptional<ZodArray<HttpQueryValue>>
  >
>;
