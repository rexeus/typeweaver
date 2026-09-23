import type {
  NormalizedHttpBody,
  NormalizedOperation,
  NormalizedRequest,
  NormalizedResponse,
  NormalizedResponseUsage,
  NormalizedSpec,
} from "@rexeus/typeweaver-gen";
import { z } from "zod";

type HttpMethod = NormalizedOperation["method"];

type TreeNode = {
  readonly name: string;
  readonly children: readonly TreeNode[];
};

type RequestBuilder = Omit<
  NonNullable<NormalizedOperation["request"]>,
  "body"
> & {
  readonly body?: z.ZodType | NormalizedHttpBody | undefined;
};

type OperationBuilderOverrides = Omit<
  Partial<NormalizedOperation>,
  "request"
> & {
  readonly request?: RequestBuilder;
};

type ResponseBuilderOverrides = Omit<Partial<NormalizedResponse>, "body"> & {
  readonly body?: z.ZodType | NormalizedHttpBody | undefined;
};

export function aJsonNormalizedBody(schema: z.ZodType): NormalizedHttpBody {
  return {
    schema,
    mediaType: "application/json",
    mediaTypeSource: "body-schema",
    transport: "json",
  };
}

function normalizeBodyForBuilder(
  body: z.ZodType | NormalizedHttpBody | undefined
): NormalizedHttpBody | undefined {
  if (body === undefined) {
    return undefined;
  }

  return "schema" in body ? body : aJsonNormalizedBody(body);
}

export function todoApiOptions() {
  return {};
}

export function aTodoSpecWith(
  overrides: {
    readonly operations?: readonly NormalizedOperation[];
    readonly responses?: readonly NormalizedResponse[];
  } = {}
): NormalizedSpec {
  return aNormalizedSpecWith({
    resources: [
      {
        name: "Todos",
        tags: [],
        security: { requirements: [], source: "none" },
        operations: overrides.operations ?? [],
      },
    ],
    responses: overrides.responses ?? [],
  });
}

export function aNormalizedSpecWith(
  overrides: Partial<NormalizedSpec> = {}
): NormalizedSpec {
  return {
    metadata: { title: "Todo API", version: "1.0.0" },
    securitySchemes: [],
    security: { requirements: [], source: "none" },
    resources: [],
    responses: [],
    warnings: [],
    ...overrides,
  };
}

export function anOperationWith(
  overrides: OperationBuilderOverrides = {}
): NormalizedOperation {
  const request = overrides.request;

  return {
    operationId: "getTodo",
    method: anHttpMethod("GET"),
    path: "/todos",
    summary: "",
    deprecated: overrides.deprecated ?? false,
    tags: overrides.tags ?? [],
    security: overrides.security ?? {
      requirements: [],
      source: "none" as const,
    },
    responses: [],
    ...overrides,
    request:
      request === undefined
        ? undefined
        : { ...request, body: normalizeBodyForBuilder(request.body) },
  };
}

export function aResponseWith(
  overrides: ResponseBuilderOverrides = {}
): NormalizedResponse {
  return {
    name: "OkResponse",
    statusCode: 200 as NormalizedResponse["statusCode"],
    statusCodeName: "Ok",
    description: "OK",
    kind: "response",
    ...overrides,
    body: normalizeBodyForBuilder(overrides.body),
  };
}

export function anInlineResponseUsage(
  response: NormalizedResponse
): NormalizedResponseUsage {
  return {
    responseName: response.name,
    source: "inline",
    response,
  };
}

export function aCanonicalResponseUsage(
  responseName: string
): NormalizedResponseUsage {
  return { responseName, source: "canonical" };
}

/**
 * Normalized specs reach `buildOpenApiDocument` as runtime data, so tests hand
 * it Zod containers (defaults, catches, non-string header values) that the
 * static normalized contract does not describe. The guard checks only that the
 * value is a Zod schema; the container shape is deliberately left unverified.
 */
function isZodSchemaOutsideContract<TContainer extends z.core.$ZodType>(
  schema: z.core.$ZodType
): schema is TContainer {
  return schema instanceof z.ZodType;
}

function admitZodSchemaOutsideContract<TContainer extends z.core.$ZodType>(
  schema: z.core.$ZodType
): TContainer {
  if (!isZodSchemaOutsideContract<TContainer>(schema)) {
    throw new TypeError("Expected a Zod schema for a normalized container");
  }

  return schema;
}

export function aQuerySchemaForBuilder(
  schema: z.core.$ZodType
): NonNullable<NormalizedRequest["query"]> {
  return admitZodSchemaOutsideContract(schema);
}

export function aRequestHeaderSchemaForBuilder(
  schema: z.core.$ZodType
): NonNullable<NormalizedRequest["header"]> {
  return admitZodSchemaOutsideContract(schema);
}

export function aHeaderSchemaForBuilder(
  schema: z.core.$ZodType
): NonNullable<NormalizedResponse["header"]> {
  return admitZodSchemaOutsideContract(schema);
}

const HTTP_METHOD_NAMES: Readonly<Record<`${HttpMethod}`, true>> = {
  GET: true,
  POST: true,
  PUT: true,
  DELETE: true,
  PATCH: true,
  OPTIONS: true,
  HEAD: true,
};

function isHttpMethod(name: string): name is HttpMethod {
  return Object.hasOwn(HTTP_METHOD_NAMES, name);
}

/** Resolves a method name to the core `HttpMethod` enum member it names. */
export function anHttpMethod(name: `${HttpMethod}`): HttpMethod {
  if (!isHttpMethod(name)) {
    throw new TypeError(`Unknown HTTP method: ${name}`);
  }

  return name;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parses JSON text and fails the test unless it holds a JSON object. */
export function parseJsonObject(
  text: string,
  subject: string
): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (!isJsonObject(parsed)) {
    throw new TypeError(`Expected ${subject} to be a JSON object`);
  }

  return parsed;
}

export function aRecursiveTreeNodeSchema(): z.ZodType<TreeNode> {
  const treeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
    z.object({ name: z.string(), children: z.array(treeNodeSchema) })
  );

  return treeNodeSchema;
}

/**
 * The CLI plugin loader calls a plugin factory with the raw user config, which
 * the factory must validate itself. The guard widens only the parameter, so
 * configuration tests reach the factory with the same untyped value.
 */
function acceptsRawConfig<TPlugin>(
  factory: (config: never) => TPlugin
): factory is (config: unknown) => TPlugin {
  return typeof factory === "function";
}

export function instantiateWithRawConfig<TPlugin>(
  factory: (config: never) => TPlugin,
  config: unknown
): TPlugin {
  if (!acceptsRawConfig(factory)) {
    throw new TypeError("Expected a plugin factory function");
  }

  return factory(config);
}
