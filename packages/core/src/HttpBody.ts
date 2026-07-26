import type { ZodType } from "zod";

/**
 * An HTTP body before a schema or transport adapter has narrowed it.
 *
 * Generated request and response types replace this boundary with their
 * schema-derived body type.
 */
export type IHttpBody = unknown;

export type HttpBodySchema = ZodType;
