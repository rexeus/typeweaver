import type { HttpBodySchema } from "./HttpBody.js";
import type { HttpHeaderSchema } from "./HttpHeader.js";
import type { HttpStatusCode } from "./HttpStatusCode.js";

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
   * merged onto the parent schema. The transport-safe `HttpHeaderSchema`
   * contract is unchanged by the request-boundary work.
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

export const responseDefinitionMetadataSymbol = Symbol.for(
  "@rexeus/typeweaver/response-definition-metadata"
);
