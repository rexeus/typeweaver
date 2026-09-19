import type { ZodObject, ZodOptional, ZodRecord } from "zod";

export type IHttpQuery = Record<string, string | string[]> | undefined;

export type RawHttpQueryValue = string | readonly string[];

export type IRawHttpQuery =
  | Readonly<Record<string, RawHttpQueryValue>>
  | undefined;

type HttpQueryObject = ZodObject | ZodRecord;

export type HttpQuerySchema = HttpQueryObject | ZodOptional<HttpQueryObject>;
