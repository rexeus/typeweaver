import type {
  ZodArray,
  ZodEnum,
  ZodLiteral,
  ZodObject,
  ZodOptional,
  ZodString,
  ZodStringFormat,
} from "zod";

export type IHttpQuery = Record<string, string | string[]> | undefined;

type HttpQueryValue =
  | ZodString
  | ZodStringFormat
  | ZodLiteral<string>
  | ZodEnum<Record<string, string>>;

type HttpQueryObject = ZodObject<
  Record<
    string,
    | HttpQueryValue
    | ZodOptional<HttpQueryValue>
    | ZodArray<HttpQueryValue>
    | ZodOptional<ZodArray<HttpQueryValue>>
  >
>;

export type HttpQuerySchema = HttpQueryObject | ZodOptional<HttpQueryObject>;
