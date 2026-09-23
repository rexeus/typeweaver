import { z } from "zod";
import { ResponseDefinitionMergeError } from "./responseDefinitionMetadata.js";
import type { HttpBodySchema } from "./HttpBody.js";
import type { HttpHeaderSchema } from "./HttpHeader.js";

export type MergeHeaderSchemas<
  TParent extends HttpHeaderSchema | undefined,
  TChild extends HttpHeaderSchema | undefined,
> = TParent extends undefined
  ? TChild
  : TChild extends undefined
    ? TParent
    : TParent & TChild;

export type MergeBodySchemas<
  TParent extends HttpBodySchema | undefined,
  TChild extends HttpBodySchema | undefined,
> = TParent extends undefined
  ? TChild
  : TChild extends undefined
    ? TParent
    : TParent extends z.ZodObject<infer TParentShape>
      ? TChild extends z.ZodObject<infer TChildShape>
        ? z.ZodObject<TParentShape & TChildShape>
        : TChild
      : TChild;

type HeaderObject = Extract<HttpHeaderSchema, z.ZodObject>;

type ObjectLike = HeaderObject | z.ZodOptional<HeaderObject>;

const isOptionalObject = (
  schema: HttpHeaderSchema
): schema is z.ZodOptional<HeaderObject> =>
  schema instanceof z.ZodOptional && schema.unwrap() instanceof z.ZodObject;

const isObjectLike = (schema: HttpHeaderSchema): schema is ObjectLike =>
  schema instanceof z.ZodObject || isOptionalObject(schema);

const isRecordLike = (schema: HttpHeaderSchema): boolean =>
  schema instanceof z.ZodRecord ||
  (schema instanceof z.ZodOptional && schema.unwrap() instanceof z.ZodRecord);

const objectShape = (schema: ObjectLike): HeaderObject["shape"] =>
  schema instanceof z.ZodObject ? schema.shape : schema.unwrap().shape;

const shouldOptionalize = (
  parent: ObjectLike,
  child: ObjectLike,
  merged: HeaderObject
): boolean =>
  (isOptionalObject(parent) || isOptionalObject(child)) &&
  Object.values(merged.shape).every(schema => schema instanceof z.ZodOptional);

export const mergeHeaderSchemas = (
  parent: HttpHeaderSchema | undefined,
  child: HttpHeaderSchema | undefined,
  responseName: string
): HttpHeaderSchema | undefined => {
  if (parent === undefined) return child;
  if (child === undefined) return parent;
  if (isRecordLike(parent) || isRecordLike(child)) {
    throw new ResponseDefinitionMergeError(
      `Cannot derive response '${responseName}' because ZodRecord headers cannot be merged.`
    );
  }
  if (!isObjectLike(parent) || !isObjectLike(child)) {
    throw new ResponseDefinitionMergeError(
      `Cannot derive response '${responseName}' because its headers are not structurally mergeable.`
    );
  }
  const merged = z.object({ ...objectShape(parent), ...objectShape(child) });
  return shouldOptionalize(parent, child, merged) ? merged.optional() : merged;
};

export const mergeBodySchemas = (
  parent: HttpBodySchema | undefined,
  child: HttpBodySchema | undefined,
  responseName: string
): HttpBodySchema | undefined => {
  if (parent === undefined) return child;
  if (child === undefined) return parent;
  if (parent instanceof z.ZodObject && child instanceof z.ZodObject) {
    return z.object({ ...parent.shape, ...child.shape });
  }
  if (child instanceof z.ZodType) return child;
  throw new ResponseDefinitionMergeError(
    `Cannot derive response '${responseName}' because its body is not structurally mergeable.`
  );
};
