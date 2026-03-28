import type {
  HttpBodySchema,
  HttpHeaderSchema,
  HttpMethod,
  HttpParamSchema,
  HttpQuerySchema,
  HttpStatusCode,
} from "@rexeus/typeweaver-core";

export type NormalizedSpec = {
  readonly resources: readonly NormalizedResource[];
  readonly responses: readonly NormalizedResponse[];
};

export type NormalizedResource = {
  readonly name: string;
  readonly operations: readonly NormalizedOperation[];
};

export type NormalizedOperation = {
  readonly operationId: string;
  readonly method: HttpMethod;
  readonly path: string;
  readonly summary: string;
  readonly request?: NormalizedRequest;
  readonly responses: readonly NormalizedResponseUsage[];
};

export type NormalizedRequest = {
  readonly header?: HttpHeaderSchema;
  readonly param?: HttpParamSchema;
  readonly query?: HttpQuerySchema;
  readonly body?: HttpBodySchema;
};

export type NormalizedResponse = {
  readonly name: string;
  readonly statusCode: HttpStatusCode;
  readonly statusCodeName: string;
  readonly description: string;
  readonly header?: HttpHeaderSchema;
  readonly body?: HttpBodySchema;
  readonly kind: "response" | "derived-response";
  readonly derivedFrom?: string;
  readonly lineage?: readonly string[];
  readonly depth?: number;
};

export type NormalizedCanonicalResponseUsage = {
  readonly responseName: string;
  readonly source: "canonical";
};

export type NormalizedInlineResponseUsage = {
  readonly responseName: string;
  readonly source: "inline";
  readonly response: NormalizedResponse;
};

export type NormalizedResponseUsage =
  | NormalizedCanonicalResponseUsage
  | NormalizedInlineResponseUsage;
