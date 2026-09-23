import {
  mergeBodySchemas,
  mergeHeaderSchemas,
} from "./responseDefinitionMerge.js";
import { attachResponseDefinitionMetadata } from "./responseDefinitionMetadata.js";
import type { HttpBodySchema } from "./HttpBody.js";
import type { HttpHeaderSchema } from "./HttpHeader.js";
import type { HttpStatusCode } from "./HttpStatusCode.js";
import type {
  MergeBodySchemas,
  MergeHeaderSchemas,
} from "./responseDefinitionMerge.js";
import type {
  DerivedResponseMetadata,
  DerivedResponseOverrides,
  DefineResponseInput,
  ResponseDefinition,
} from "./responseDefinitionTypes.js";

type ResponseLineage<
  TResponse extends ResponseDefinition,
  TName extends string,
> =
  TResponse["derived"] extends DerivedResponseMetadata<string, infer TLineage>
    ? readonly [...TLineage, TName]
    : readonly [TName];

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
> => deriveResponse(base, overrides);

// The merged schema and lineage types mirror the runtime merge rules, which the
// compiler cannot follow through `??`, spreads, and conditional types; the
// implementation is therefore checked against the widest response shape.
function deriveResponse<
  TBase extends ResponseDefinition,
  TName extends string,
  TStatusCode extends HttpStatusCode,
  TDescription extends string,
  THeader extends HttpHeaderSchema | undefined,
  TBody extends HttpBodySchema | undefined,
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
>;
function deriveResponse(
  base: ResponseDefinition,
  overrides: DerivedResponseOverrides<
    string,
    HttpStatusCode,
    string,
    HttpHeaderSchema | undefined,
    HttpBodySchema | undefined
  >
): ResponseDefinition {
  return attachResponseDefinitionMetadata(
    {
      name: overrides.name,
      statusCode: overrides.statusCode ?? base.statusCode,
      description: overrides.description ?? base.description,
      header: mergeHeaderSchemas(base.header, overrides.header, overrides.name),
      body: mergeBodySchemas(base.body, overrides.body, overrides.name),
      derived: {
        parentName: base.name,
        lineage: [...(base.derived?.lineage ?? []), overrides.name],
        depth: (base.derived?.depth ?? 0) + 1,
      },
    },
    { source: "define-derived-response" }
  );
}
