import { z } from "zod";
import type { HttpBodySchema } from "./HttpBody";
import type { HttpHeaderSchema } from "./HttpHeader";
import type { HttpStatusCode } from "./HttpStatusCode";

export const responseDefinitionMetadataSymbol = Symbol.for(
  "@rexeus/typeweaver/response-definition-metadata"
);

export type ResponseDefinitionMetadata = {
  readonly source: "define-response" | "define-derived-response";
};

export type DerivedResponseMetadata<
  TParentName extends string = string,
  TLineage extends readonly string[] = readonly string[],
> = {
  readonly parentName: TParentName;
  readonly lineage: TLineage;
  readonly depth: TLineage["length"];
};

export type ResponseDefinition<
  TName extends string = string,
  TStatusCode extends HttpStatusCode = HttpStatusCode,
  TDescription extends string = string,
  THeader extends HttpHeaderSchema | undefined = HttpHeaderSchema | undefined,
  TBody extends HttpBodySchema | undefined = HttpBodySchema | undefined,
  TDerived extends DerivedResponseMetadata | undefined =
    | DerivedResponseMetadata
    | undefined,
> = {
  readonly name: TName;
  readonly statusCode: TStatusCode;
  readonly description: TDescription;
  readonly header?: THeader;
  readonly body?: TBody;
  readonly derived?: TDerived;
  readonly [responseDefinitionMetadataSymbol]?: ResponseDefinitionMetadata;
};

export type DefineResponseInput<
  TName extends string,
  TStatusCode extends HttpStatusCode,
  TDescription extends string,
  THeader extends HttpHeaderSchema | undefined,
  TBody extends HttpBodySchema | undefined,
> = Omit<
  ResponseDefinition<TName, TStatusCode, TDescription, THeader, TBody>,
  "derived"
>;

export type DerivedResponseOverrides<
  TName extends string,
  TStatusCode extends HttpStatusCode,
  TDescription extends string,
  THeader extends HttpHeaderSchema | undefined,
  TBody extends HttpBodySchema | undefined,
> = {
  readonly name: TName;
  readonly statusCode?: TStatusCode;
  readonly description?: TDescription;
  readonly header?: THeader;
  readonly body?: TBody;
};

export class ResponseDefinitionMergeError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ResponseDefinitionMergeError";
  }
}

const attachResponseDefinitionMetadata = <TResponse extends ResponseDefinition>(
  response: TResponse,
  metadata: ResponseDefinitionMetadata
): TResponse => {
  Object.defineProperty(response, responseDefinitionMetadataSymbol, {
    value: metadata,
    enumerable: false,
    configurable: false,
    writable: false,
  });

  return response;
};

export const getResponseDefinitionMetadata = (
  response: ResponseDefinition
): ResponseDefinitionMetadata | undefined => {
  return response[responseDefinitionMetadataSymbol];
};

export const isNamedResponseDefinition = (
  response: ResponseDefinition
): boolean => {
  return getResponseDefinitionMetadata(response) !== undefined;
};

type ResponseLineage<
  TResponse extends ResponseDefinition,
  TName extends string,
> =
  TResponse["derived"] extends DerivedResponseMetadata<any, infer TLineage>
    ? readonly [...TLineage, TName]
    : readonly [TName];

type MergeHeaderSchemas<
  TParent extends HttpHeaderSchema | undefined,
  TChild extends HttpHeaderSchema | undefined,
> = TParent extends undefined
  ? TChild
  : TChild extends undefined
    ? TParent
    : TParent & TChild;

type MergeBodySchemas<
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

const isOptionalZodObject = (
  schema: unknown
): schema is z.ZodOptional<z.ZodObject<z.core.$ZodShape>> => {
  return (
    schema instanceof z.ZodOptional && schema.unwrap() instanceof z.ZodObject
  );
};

const isZodObjectLike = (
  schema: unknown
): schema is
  | z.ZodObject<z.core.$ZodShape>
  | z.ZodOptional<z.ZodObject<z.core.$ZodShape>> => {
  return schema instanceof z.ZodObject || isOptionalZodObject(schema);
};

const getZodObjectShape = (
  schema:
    | z.ZodObject<z.core.$ZodShape>
    | z.ZodOptional<z.ZodObject<z.core.$ZodShape>>
): z.core.$ZodShape => {
  return schema instanceof z.ZodObject ? schema.shape : schema.unwrap().shape;
};

const shouldWrapMergedObjectAsOptional = (
  parent:
    | z.ZodObject<z.core.$ZodShape>
    | z.ZodOptional<z.ZodObject<z.core.$ZodShape>>,
  child:
    | z.ZodObject<z.core.$ZodShape>
    | z.ZodOptional<z.ZodObject<z.core.$ZodShape>>,
  merged: z.ZodObject<z.core.$ZodShape>
): boolean => {
  if (isOptionalZodObject(parent) || isOptionalZodObject(child)) {
    return Object.values(merged.shape).every(
      schema => schema instanceof z.ZodOptional
    );
  }

  return false;
};

const mergeHeaderSchemas = <
  TParent extends HttpHeaderSchema | undefined,
  TChild extends HttpHeaderSchema | undefined,
>(
  parent: TParent,
  child: TChild,
  responseName: string
): MergeHeaderSchemas<TParent, TChild> => {
  if (parent === undefined) {
    return child as MergeHeaderSchemas<TParent, TChild>;
  }

  if (child === undefined) {
    return parent as MergeHeaderSchemas<TParent, TChild>;
  }

  if (
    parent instanceof z.ZodRecord ||
    child instanceof z.ZodRecord ||
    (parent instanceof z.ZodOptional &&
      parent.unwrap() instanceof z.ZodRecord) ||
    (child instanceof z.ZodOptional && child.unwrap() instanceof z.ZodRecord)
  ) {
    throw new ResponseDefinitionMergeError(
      `Cannot derive response '${responseName}' because ZodRecord headers cannot be merged.`
    );
  }

  if (!isZodObjectLike(parent) || !isZodObjectLike(child)) {
    throw new ResponseDefinitionMergeError(
      `Cannot derive response '${responseName}' because its headers are not structurally mergeable.`
    );
  }

  const merged = z.object({
    ...getZodObjectShape(parent),
    ...getZodObjectShape(child),
  });

  if (shouldWrapMergedObjectAsOptional(parent, child, merged)) {
    return merged.optional() as MergeHeaderSchemas<TParent, TChild>;
  }

  return merged as MergeHeaderSchemas<TParent, TChild>;
};

const mergeBodySchemas = <
  TParent extends HttpBodySchema | undefined,
  TChild extends HttpBodySchema | undefined,
>(
  parent: TParent,
  child: TChild,
  responseName: string
): MergeBodySchemas<TParent, TChild> => {
  if (parent === undefined) {
    return child as MergeBodySchemas<TParent, TChild>;
  }

  if (child === undefined) {
    return parent as MergeBodySchemas<TParent, TChild>;
  }

  if (parent instanceof z.ZodObject && child instanceof z.ZodObject) {
    return z.object({
      ...parent.shape,
      ...child.shape,
    }) as MergeBodySchemas<TParent, TChild>;
  }

  if (child instanceof z.ZodType) {
    return child as MergeBodySchemas<TParent, TChild>;
  }

  throw new ResponseDefinitionMergeError(
    `Cannot derive response '${responseName}' because its body is not structurally mergeable.`
  );
};

export const defineResponse = <
  TName extends string,
  TStatusCode extends HttpStatusCode,
  TDescription extends string,
  THeader extends HttpHeaderSchema | undefined = undefined,
  TBody extends HttpBodySchema | undefined = undefined,
>(
  definition: DefineResponseInput<
    TName,
    TStatusCode,
    TDescription,
    THeader,
    TBody
  >
): ResponseDefinition<TName, TStatusCode, TDescription, THeader, TBody> => {
  return attachResponseDefinitionMetadata(definition, {
    source: "define-response",
  });
};

export const defineDerivedResponse = <
  TBase extends ResponseDefinition,
  TName extends string,
  TStatusCode extends HttpStatusCode = TBase["statusCode"],
  TDescription extends string = TBase["description"],
  THeader extends HttpHeaderSchema | undefined = undefined,
  TBody extends HttpBodySchema | undefined = undefined,
>(
  base: TBase,
  overrides: DerivedResponseOverrides<
    TName,
    TStatusCode,
    TDescription,
    THeader,
    TBody
  >
): ResponseDefinition<
  TName,
  TStatusCode,
  TDescription,
  MergeHeaderSchemas<TBase["header"], THeader>,
  MergeBodySchemas<TBase["body"], TBody>,
  DerivedResponseMetadata<TBase["name"], ResponseLineage<TBase, TName>>
> => {
  return attachResponseDefinitionMetadata(
    {
      name: overrides.name,
      statusCode: (overrides.statusCode ?? base.statusCode) as TStatusCode,
      description: (overrides.description ?? base.description) as TDescription,
      header: mergeHeaderSchemas(
        base.header,
        overrides.header,
        overrides.name
      ) as MergeHeaderSchemas<TBase["header"], THeader>,
      body: mergeBodySchemas(
        base.body,
        overrides.body,
        overrides.name
      ) as MergeBodySchemas<TBase["body"], TBody>,
      derived: {
        parentName: base.name,
        lineage: [
          ...(base.derived?.lineage ?? []),
          overrides.name,
        ] as unknown as ResponseLineage<TBase, TName>,
        depth: (base.derived?.depth ?? 0) + 1,
      },
    },
    {
      source: "define-derived-response",
    }
  );
};
