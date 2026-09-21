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

type ObjectLike =
  | z.ZodObject<z.core.$ZodShape>
  | z.ZodOptional<z.ZodObject<z.core.$ZodShape>>;

const isOptionalObject = (
  schema: unknown
): schema is z.ZodOptional<z.ZodObject<z.core.$ZodShape>> =>
  schema instanceof z.ZodOptional && schema.unwrap() instanceof z.ZodObject;

const isObjectLike = (schema: unknown): schema is ObjectLike =>
  schema instanceof z.ZodObject || isOptionalObject(schema);

const isRecordLike = (schema: HttpHeaderSchema): boolean =>
  schema instanceof z.ZodRecord ||
  (schema instanceof z.ZodOptional && schema.unwrap() instanceof z.ZodRecord);

const objectShape = (schema: ObjectLike): z.core.$ZodShape =>
  schema instanceof z.ZodObject ? schema.shape : schema.unwrap().shape;

const shouldOptionalize = (
  parent: ObjectLike,
  child: ObjectLike,
  merged: z.ZodObject<z.core.$ZodShape>
): boolean =>
  (isOptionalObject(parent) || isOptionalObject(child)) &&
  Object.values(merged.shape).every(schema => schema instanceof z.ZodOptional);

export const mergeHeaderSchemas = <
  TParent extends HttpHeaderSchema | undefined,
  TChild extends HttpHeaderSchema | undefined,
>(
  parent: TParent,
  child: TChild,
  responseName: string
): MergeHeaderSchemas<TParent, TChild> => {
  if (parent === undefined) return child as MergeHeaderSchemas<TParent, TChild>;
  if (child === undefined) return parent as MergeHeaderSchemas<TParent, TChild>;
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
  return (
    shouldOptionalize(parent, child, merged) ? merged.optional() : merged
  ) as MergeHeaderSchemas<TParent, TChild>;
};

export const mergeBodySchemas = <
  TParent extends HttpBodySchema | undefined,
  TChild extends HttpBodySchema | undefined,
>(
  parent: TParent,
  child: TChild,
  responseName: string
): MergeBodySchemas<TParent, TChild> => {
  if (parent === undefined) return child as MergeBodySchemas<TParent, TChild>;
  if (child === undefined) return parent as MergeBodySchemas<TParent, TChild>;
  if (parent instanceof z.ZodObject && child instanceof z.ZodObject) {
    return z.object({ ...parent.shape, ...child.shape }) as MergeBodySchemas<
      TParent,
      TChild
    >;
  }
  if (child instanceof z.ZodType)
    return child as MergeBodySchemas<TParent, TChild>;
  throw new ResponseDefinitionMergeError(
    `Cannot derive response '${responseName}' because its body is not structurally mergeable.`
  );
};
