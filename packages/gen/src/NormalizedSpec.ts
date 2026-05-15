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
  readonly warnings: readonly NormalizedSpecWarning[];
};

export type NormalizedBodyMediaTypeSource =
  | "content-type-header"
  | "body-schema"
  | "raw-fallback";

export type NormalizedBodyTransport =
  | "json"
  | "text"
  | "form-url-encoded"
  | "multipart"
  | "raw";

export type NormalizedHttpBody = {
  readonly schema: HttpBodySchema;
  readonly mediaType: string;
  readonly mediaTypeSource: NormalizedBodyMediaTypeSource;
  readonly transport: NormalizedBodyTransport;
};

export type NormalizedSpecWarningCode =
  | "ambiguous-content-type-header"
  | "missing-content-type-header"
  | "raw-body-media-type-fallback";

export type NormalizedSpecWarningLocation = {
  readonly part: "request.body" | "response.body";
  readonly resourceName?: string;
  readonly operationId?: string;
  readonly responseName?: string;
  readonly statusCode?: HttpStatusCode;
};

export type NormalizedSpecWarning = {
  readonly code: NormalizedSpecWarningCode;
  readonly message: string;
  readonly location: NormalizedSpecWarningLocation;
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
  readonly body?: NormalizedHttpBody;
};

export type NormalizedResponse = {
  readonly name: string;
  readonly statusCode: HttpStatusCode;
  readonly statusCodeName: string;
  readonly description: string;
  readonly header?: HttpHeaderSchema;
  readonly body?: NormalizedHttpBody;
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
