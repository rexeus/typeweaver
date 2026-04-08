import { z } from "zod";
import type { HttpBodySchema } from "./HttpBody.js";
import type { HttpHeaderSchema } from "./HttpHeader.js";
import type { HttpStatusCode } from "./HttpStatusCode.js";

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
  /**
   * References the immediate parent in the derivation chain. For a first-level
   * derived response this equals the canonical response name
   */
  readonly parentName: TParentName;
  /**
   * Traces the full derivation path from root to this response.
   * A response derived from "NotFoundError" via "TodoNotFoundError" has
   * lineage `["TodoNotFoundError"]` at depth 1
   */
  readonly lineage: TLineage;
  /**
   * Always equals `lineage.length`. Fast check for derivation depth
   * without traversing the array
   */
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
  /**
   * Must be globally unique across all operations in a spec.
   * Used as the generated class and type name
   */
  readonly name: TName;
  /**
   * HTTP status code sent to the client. Must be a valid `HttpStatusCode` value
   */
  readonly statusCode: TStatusCode;
  /**
   * Appears in generated OpenAPI descriptions and as the default error
   * message for error responses
   */
  readonly description: TDescription;
  /**
   * Zod schema for response headers. When derived, child headers are
   * merged onto the parent schema
   */
  readonly header?: THeader;
  /**
   * Zod schema for the response body. When derived, ZodObject bodies are
   * shallow-merged; other schema types are replaced
   */
  readonly body?: TBody;
  /**
   * Present only on responses created via `defineDerivedResponse`.
   * Do not set manually
   */
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
  /**
   * Unique name for this derived variant
   */
  readonly name: TName;
  /**
   * Overrides the parent status code. Omit to inherit
   */
  readonly statusCode?: TStatusCode;
  /**
   * Overrides the parent description. Omit to inherit
   */
  readonly description?: TDescription;
  /**
   * Additional header fields merged onto the parent's header schema
   */
  readonly header?: THeader;
  /**
   * Body schema merged onto or replacing the parent's body schema
   */
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

/**
 * Declares a canonical response that can be shared across operations and
 * used as the base for derived responses.
 *
 * @param definition - The response metadata and optional schemas
 * @returns The response definition with non-enumerable authoring metadata attached
 *
 * @example
 * ```ts
 * const NotFoundError = defineResponse({
 *   name: "NotFoundError",
 *   statusCode: HttpStatusCode.NOT_FOUND,
 *   description: "The requested resource was not found",
 *   body: z.object({ message: z.string() }),
 * });
 * ```
 */
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

/**
 * Creates a response derived from a canonical parent, inheriting and
 * merging schemas while recording lineage metadata.
 *
 * @param base - The canonical or previously derived response to extend
 * @param overrides - The derived response name and optional schema overrides
 * @returns A new response definition with merged schemas and lineage metadata
 *
 * @example
 * ```ts
 * const TodoNotFoundError = defineDerivedResponse(NotFoundError, {
 *   name: "TodoNotFoundError",
 *   body: z.object({ todoId: z.string().uuid() }),
 * });
 * ```
 */
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
