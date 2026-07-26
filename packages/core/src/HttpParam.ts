import type { ZodObject } from "zod";

export type IHttpParam = Record<string, string> | undefined;

export type IRawHttpParam = Readonly<Record<string, string>> | undefined;

export type HttpParamSchema = ZodObject;
